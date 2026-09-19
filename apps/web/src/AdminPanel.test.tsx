import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient, usePreferences } from './lib';
import { AdminPanel } from './AdminPanel';

vi.hoisted(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  });
});

let writes: Array<{ path: string; body: Record<string, unknown> }>;
let reads: string[];
let customResponse: (url: URL) => Response | Promise<Response> | undefined;
const building = {
  id: 'b1',
  kind: 'buildings',
  nameZh: '第一宿舍',
  nameEn: 'Hall One',
  active: true,
};
const category = { id: 'c1', kind: 'categories', nameZh: '教材', nameEn: 'Books', active: true };
const collection = {
  id: 'z1',
  titleZh: '毕业季',
  titleEn: 'Graduation',
  descriptionZh: '同楼旧书',
  descriptionEn: 'Books in your hall',
  startsAt: '2026-06-01T00:00:00Z',
  endsAt: '2026-07-01T00:00:00Z',
  enabled: true,
  categoryId: 'c1',
  buildingId: 'b1',
};

beforeEach(() => {
  queryClient.clear();
  usePreferences.setState({ locale: 'en' });
  writes = [];
  reads = [];
  customResponse = () => undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const path = input.replace('/api/v1', '');
      const url = new URL(path, 'http://localhost');
      reads.push(path);
      if (init?.method && init.method !== 'GET') {
        writes.push({ path, body: JSON.parse(String(init.body)) });
        return Response.json({ data: { id: 'saved' } });
      }
      const custom = customResponse(url);
      if (custom) return custom;
      let data: unknown = { items: [], nextCursor: null };
      if (url.pathname === '/auth/csrf') data = { token: 'test-token' };
      if (url.pathname === '/me') data = { id: 'admin', role: 'ADMIN' };
      if (['/admin/dictionaries/buildings', '/dictionaries/buildings'].includes(url.pathname))
        data = { items: [building], nextCursor: null };
      if (['/admin/dictionaries/categories', '/dictionaries/categories'].includes(url.pathname))
        data = { items: [category], nextCursor: null };
      if (url.pathname === '/admin/zones') data = { items: [collection], nextCursor: null };
      return Response.json({ data });
    }),
  );
});

function mount() {
  render(
    <QueryClientProvider client={queryClient}>
      <AdminPanel />
    </QueryClientProvider>,
  );
}

it('edits both dictionary names without resetting its active status', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Campus dictionaries' }));
  await screen.findByText('Hall One');
  fireEvent.click(screen.getByRole('button', { name: 'Edit Hall One' }));
  expect(screen.getByRole('button', { name: 'Disable' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Chinese name'), { target: { value: '一号宿舍' } });
  fireEvent.change(screen.getByLabelText('English name'), { target: { value: 'Residence One' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(writes).toContainEqual({
      path: '/admin/dictionaries/buildings/b1',
      body: { nameZh: '一号宿舍', nameEn: 'Residence One', active: true },
    }),
  );
  expect(await screen.findByRole('status')).toHaveTextContent('Saved');
});

it('preserves collection descriptions and eligibility when disabling it', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Collections' }));
  await screen.findByText('Graduation');
  fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({
    path: '/admin/zones/z1',
    body: {
      titleZh: collection.titleZh,
      titleEn: collection.titleEn,
      descriptionZh: collection.descriptionZh,
      descriptionEn: collection.descriptionEn,
      startsAt: collection.startsAt,
      endsAt: collection.endsAt,
      categoryId: 'c1',
      buildingId: 'b1',
      enabled: false,
    },
  });
});

it('edits collection eligibility and rejects an end time before its start', async () => {
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Collections' }));
  await screen.findByText('Graduation');
  fireEvent.click(screen.getByRole('button', { name: 'Edit Graduation' }));
  expect(screen.getByLabelText('English description')).toHaveValue('Books in your hall');
  expect(screen.getByLabelText('Include category')).toHaveValue('c1');
  expect(screen.getByLabelText('Include building')).toHaveValue('b1');
  fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '2026-08-02T12:00' } });
  fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-08-01T12:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('End time must be after start time');
  expect(writes).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '2026-08-03T12:00' } });
  fireEvent.change(screen.getByLabelText('Include building'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].body).toMatchObject({
    buildingId: null,
    categoryId: 'c1',
    descriptionEn: 'Books in your hall',
  });
});

it('loads further accounts and resets the cursor when applying filters', async () => {
  customResponse = (url) => {
    if (url.pathname !== '/admin/users') return;
    const filtered = url.searchParams.get('q') === 'Bob';
    const next = url.searchParams.has('cursor');
    return Response.json({
      data: {
        items: [
          {
            id: filtered || next ? 'u2' : 'u1',
            nickname: filtered || next ? 'Bob' : 'Alice',
            role: 'STUDENT',
            status: 'ACTIVE',
          },
        ],
        nextCursor: filtered || next ? null : 'page-two',
      },
    });
  };
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Accounts' }));
  await screen.findByText('Alice');
  fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
  await screen.findByText('Bob');
  expect(screen.getByText('Alice')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Bob' } });
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'ACTIVE' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(screen.queryByText('Alice')).not.toBeInTheDocument());
  const filteredRead = reads
    .map((path) => new URL(path, 'http://localhost'))
    .find((url) => url.searchParams.get('q') === 'Bob');
  expect(filteredRead?.searchParams.get('status')).toBe('ACTIVE');
  expect(filteredRead?.searchParams.has('cursor')).toBe(false);
});

it('shows a failed list request as an error rather than an empty result', async () => {
  customResponse = (url) =>
    url.pathname === '/admin/listings'
      ? Response.json({ error: { code: 'DEPENDENCY_UNAVAILABLE' } }, { status: 503 })
      : undefined;
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
  expect(screen.queryByText('No matching records')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});

it('requires a reason before restricting an account', async () => {
  customResponse = (url) =>
    url.pathname === '/admin/users'
      ? Response.json({
          data: {
            items: [{ id: 'u1', nickname: 'Alice', role: 'STUDENT', status: 'ACTIVE' }],
            nextCursor: null,
          },
        })
      : undefined;
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Accounts' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Restrict' }));
  expect(screen.getByRole('button', { name: 'Confirm action' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Reason for this action'), {
    target: { value: 'Spam listings' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }));
  await waitFor(() =>
    expect(writes).toContainEqual({
      path: '/admin/users/u1/restriction',
      body: { restricted: true, reason: 'Spam listings' },
    }),
  );
});
