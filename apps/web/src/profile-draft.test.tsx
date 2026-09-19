import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { Profile } from './pages';
import { queryClient, usePreferences } from './lib';
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
it('does not overwrite an unsaved profile when a background update arrives', async () => {
  queryClient.clear();
  usePreferences.setState({ locale: 'en' });
  let remoteNickname = 'Original name';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      Response.json({
        data:
          url === '/api/v1/me'
            ? {
                id: 'me',
                nickname: remoteNickname,
                profile: { nickname: remoteNickname, courses: [] },
              }
            : { items: [], nextCursor: null },
      }),
    ),
  );
  render(
    <QueryClientProvider client={queryClient}>
      <Profile />
    </QueryClientProvider>,
  );
  const input = await screen.findByDisplayValue('Original name');
  fireEvent.change(input, { target: { value: 'My unsaved draft' } });
  remoteNickname = 'Remote edit';
  await queryClient.invalidateQueries();
  await waitFor(() => expect(queryClient.getQueryData<any>(['/me'])?.nickname).toBe('Remote edit'));
  expect(screen.getByLabelText('Nickname')).toHaveValue('My unsaved draft');
  queryClient.clear();
  vi.unstubAllGlobals();
});
