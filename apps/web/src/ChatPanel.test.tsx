import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { queryClient, usePreferences } from './lib';
import { ChatPanel } from './ChatPanel';

vi.hoisted(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  });
});
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

let reads: string[];
let conversationError: string | null;
function conversation(id: string) {
  return {
    id,
    buyerId: 'buyer',
    sellerId: 'seller',
    listingId: `listing-${id}`,
    otherUser: { nickname: `Seller ${id}` },
    listingSummary: { title: `Item ${id}`, priceMinor: 200 },
    unreadCount: 0,
  };
}

beforeEach(() => {
  queryClient.clear();
  usePreferences.setState({ locale: 'en' });
  reads = [];
  conversationError = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const path = input.replace('/api/v1', '');
      reads.push(path);
      const url = new URL(path, 'http://localhost');
      let data: unknown = { items: [], nextCursor: null };
      if (url.pathname === '/auth/csrf') data = { token: 'test-token' };
      if (url.pathname === '/me') data = { id: 'buyer', role: 'STUDENT' };
      if (url.pathname === '/conversations')
        data = url.searchParams.has('cursor')
          ? { items: [conversation('second')], nextCursor: null }
          : { items: [conversation('first')], nextCursor: 'next-page' };
      if (/^\/conversations\/[^/]+$/.test(url.pathname) && conversationError) {
        return Response.json(
          { error: { code: conversationError } },
          { status: conversationError === 'NOT_FOUND' ? 404 : 503 },
        );
      }
      if (/^\/conversations\/[^/]+$/.test(url.pathname))
        data = conversation(url.pathname.split('/')[2]);
      if (url.pathname.endsWith('/messages') && init?.method === 'GET') {
        const id = url.pathname.split('/')[2];
        data = {
          items: url.searchParams.has('afterCursor')
            ? []
            : [
                {
                  id: `message-${id}`,
                  sequence: 1,
                  senderId: 'seller',
                  body: `Hello ${id}`,
                  createdAt: '2026-09-19T10:00:00Z',
                },
              ],
          nextCursor: null,
        };
      }
      return Response.json({ data });
    }),
  );
});

it('opens a conversation directly even when it is outside the loaded list page', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <ChatPanel id="archived" />
    </QueryClientProvider>,
  );
  expect(await screen.findByText('Hello archived')).toBeInTheDocument();
  expect(reads).toContain('/conversations/archived');
  expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument();
});

it('loads another page of conversations without hiding the first page', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <ChatPanel />
    </QueryClientProvider>,
  );
  await screen.findByText('Seller first');
  fireEvent.click(await screen.findByRole('button', { name: /Load more/i }));
  expect(await screen.findByText('Seller second')).toBeInTheDocument();
  expect(screen.getByText('Seller first')).toBeInTheDocument();
  expect(reads.some((path) => path.includes('cursor=next-page'))).toBe(true);
});

it('refreshes an existing thread from the newest known sequence', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <ChatPanel id="first" />
    </QueryClientProvider>,
  );
  await screen.findByText('Hello first');
  await queryClient.invalidateQueries();
  await waitFor(() => expect(reads.some((path) => path.includes('afterCursor=1'))).toBe(true));
  expect(screen.getAllByText('Hello first')).toHaveLength(1);
});

it('keeps the draft across viewport changes and separates it when the thread changes', async () => {
  const panel = (id?: string) => (
    <QueryClientProvider client={queryClient}>
      <ChatPanel id={id} />
    </QueryClientProvider>
  );
  const view = render(panel('first'));
  await screen.findByText('Hello first');
  fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
    target: { value: 'My first draft' },
  });
  expect(view.container.querySelector('.chat-layout')).toHaveClass('has-thread');
  expect(screen.getByRole('link', { name: '← Back to conversations' })).toHaveAttribute(
    'href',
    '/messages',
  );
  fireEvent.resize(window);
  view.rerender(panel('first'));
  expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('My first draft');
  view.rerender(panel('second'));
  await screen.findByText('Hello second');
  expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('');
  view.rerender(panel());
  expect(view.container.querySelector('.chat-layout')).toHaveClass('no-thread');
  expect(screen.queryByRole('link', { name: '← Back to conversations' })).not.toBeInTheDocument();
});

it('keeps a draft when background conversation refresh fails temporarily', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <ChatPanel id="first" />
    </QueryClientProvider>,
  );
  await screen.findByText('Hello first');
  fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
    target: { value: 'Unsaved hello' },
  });
  conversationError = 'DEPENDENCY_UNAVAILABLE';
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['/conversations/first'] });
  });
  expect(screen.getByRole('alert')).toHaveTextContent('temporarily unavailable');
  expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Unsaved hello');
  conversationError = null;
  fireEvent.click(screen.getByRole('button', { name: 'Retry conversation' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Unsaved hello');
});

it('blocks cached conversation content when access is revoked', async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <ChatPanel id="first" />
    </QueryClientProvider>,
  );
  await screen.findByText('Hello first');
  conversationError = 'NOT_FOUND';
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['/conversations/first'] });
  });
  await waitFor(() =>
    expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument(),
  );
  expect(screen.queryByText('Hello first')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toBeInTheDocument();
});
