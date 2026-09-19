import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import { ChatComposer } from './ChatComposer';
it('prefills a human question and only sends after confirmation', async () => {
  const send = vi.fn().mockResolvedValue(undefined);
  render(<ChatComposer locale="en" send={send} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ask price' }));
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() =>
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'TEMPLATE', templateCode: 'ASK_PRICE', locale: 'en' }),
    ),
  );
});
it('shows failed send and reuses client id for retry', async () => {
  const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  render(<ChatComposer locale="en" send={send} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByRole('button', { name: 'Retry' });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
  expect(send.mock.calls[0][0]).toEqual(send.mock.calls[1][0]);
});

it('keeps the prepared question language when the interface switches', async () => {
  const send = vi.fn().mockResolvedValue(undefined);
  const view = render(<ChatComposer locale="en" send={send} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ask price' }));
  view.rerender(<ChatComposer locale="zh-CN" send={send} />);
  fireEvent.click(screen.getByRole('button', { name: '发送' }));
  await waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en' })));
});

it('isolates draft and failed retry when the conversation changes', async () => {
  const firstSend = vi.fn().mockRejectedValue(new Error('offline'));
  const secondSend = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <ChatComposer {...{ locale: 'en', conversationId: 'first', send: firstSend }} />,
  );
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Only for first' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByRole('button', { name: 'Retry' });
  view.rerender(<ChatComposer {...{ locale: 'en', conversationId: 'second', send: secondSend }} />);
  expect(screen.getByRole('textbox')).toHaveValue('');
  expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  expect(secondSend).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Only for second' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() =>
    expect(secondSend).toHaveBeenCalledWith(expect.objectContaining({ text: 'Only for second' })),
  );
});
