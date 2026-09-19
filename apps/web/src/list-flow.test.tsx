import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { api, ErrorNotice, LoadMore, queryClient, usePagedApi, usePreferences } from './lib';

afterEach(() => {
  queryClient.clear();
  vi.unstubAllGlobals();
});
function Fixture() {
  const [role, setRole] = useState('buyer');
  const q = usePagedApi('/trades?role=' + role);
  return (
    <>
      <button onClick={() => setRole('seller')}>Seller</button>
      {q.data?.items.map((i) => (
        <p key={i.id}>{i.title}</p>
      ))}
      <LoadMore query={q} />
    </>
  );
}
function mount() {
  usePreferences.setState({ locale: 'en' });
  render(
    <QueryClientProvider client={queryClient}>
      <Fixture />
    </QueryClientProvider>,
  );
}
function response(items: unknown[], nextCursor: string | null) {
  return new Response(JSON.stringify({ data: { items, nextCursor } }), { status: 200 });
}
it('lets a member reach older results and resets the cursor when the filter changes', async () => {
  const requested: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requested.push(url);
      const q = new URL(url, 'http://localhost').searchParams;
      if (q.get('role') === 'seller') return response([{ id: 's', title: 'Sold book' }], null);
      if (q.get('cursor')) return response([{ id: 'b', title: 'Older purchase' }], null);
      return response([{ id: 'a', title: 'Recent purchase' }], 'older');
    }),
  );
  mount();
  await screen.findByText('Recent purchase');
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('Older purchase');
  expect(screen.getByText('Recent purchase')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Seller' }));
  await screen.findByText('Sold book');
  expect(screen.queryByText('Recent purchase')).not.toBeInTheDocument();
  expect(
    requested.filter((url) => url.includes('role=seller')).every((url) => !url.includes('cursor=')),
  ).toBe(true);
});
it('keeps existing results after a failed next page and retries without duplicates', async () => {
  let nextCalls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (!url.includes('cursor=')) return response([{ id: 'a', title: 'First purchase' }], 'next');
      if (++nextCalls === 1) throw new TypeError('network');
      return response(
        [
          { id: 'a', title: 'First purchase' },
          { id: 'b', title: 'Next purchase' },
        ],
        null,
      );
    }),
  );
  mount();
  await screen.findByText('First purchase');
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByRole('button', { name: 'Retry loading more' });
  expect(screen.getByText('First purchase')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading more' }));
  await screen.findByText('Next purchase');
  expect(screen.getAllByText('First purchase')).toHaveLength(1);
});
it('shows the actual invalid field in the chosen language', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              fieldErrors: { meetingAt: 'MUST_BE_FUTURE' },
              requestId: 'example',
            },
          }),
          { status: 422 },
        ),
    ),
  );
  const error = await api('/example').catch((e: unknown) => e);
  usePreferences.setState({ locale: 'en' });
  render(<ErrorNotice error={error} />);
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Meeting time: Choose a future time.'),
  );
});
