import { describe, expect, it, vi } from 'vitest';
import {
  earlierHistory,
  mergeHistory,
  syncHistory,
  type ChatHistory,
  type ChatMessage,
} from './chat-history';

function messages(from: number, to: number): ChatMessage[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => {
    const sequence = from + index;
    return {
      id: `message-${sequence}`,
      sequence,
      senderId: 'seller',
      body: `Message ${sequence}`,
      createdAt: '2026-09-19T10:00:00Z',
    };
  });
}

function server(to: number) {
  return vi.fn(async (query: string) => {
    const q = new URLSearchParams(query);
    const limit = Number(q.get('limit'));
    if (q.has('afterCursor')) {
      const after = Number(q.get('afterCursor'));
      const end = Math.min(to, after + limit);
      return { items: messages(after + 1, end), nextCursor: end < to ? String(end) : null };
    }
    const end = Math.min(to, Number(q.get('beforeCursor') || to + 1) - 1);
    const start = Math.max(1, end - limit + 1);
    return { items: messages(start, end), nextCursor: start > 1 ? String(start) : null };
  });
}

describe('conversation history synchronization', () => {
  it('fills more than 100 reconnect messages in sequence without dropping existing history', async () => {
    const before: ChatHistory = {
      items: messages(1, 120),
      beforeCursor: null,
      hasMoreAfter: false,
    };
    const fetch = server(370);
    const after = await syncHistory(before, fetch);
    expect(after.items.map((m) => m.sequence)).toEqual(messages(1, 370).map((m) => m.sequence));
    expect(fetch.mock.calls.map(([q]) => new URLSearchParams(q).get('afterCursor'))).toEqual([
      '120',
      '220',
      '320',
    ]);
    expect(after.beforeCursor).toBeNull();
    expect(after.hasMoreAfter).toBe(false);
  });

  it('bounds a reconnect batch and resumes from the last included sequence', async () => {
    const start: ChatHistory = { items: messages(1, 10), beforeCursor: null, hasMoreAfter: false };
    const fetch = server(760);
    let current = await syncHistory(start, fetch);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(current.items.at(-1)?.sequence).toBe(310);
    expect(current.hasMoreAfter).toBe(true);
    current = await syncHistory(current, fetch);
    current = await syncHistory(current, fetch);
    expect(current.items.map((m) => m.sequence)).toEqual(messages(1, 760).map((m) => m.sequence));
    expect(current.hasMoreAfter).toBe(false);
  });

  it('treats repeated notifications and overlapping responses as the same messages', async () => {
    const start: ChatHistory = { items: messages(1, 30), beforeCursor: null, hasMoreAfter: false };
    const fetch = vi.fn().mockResolvedValue({ items: messages(20, 50), nextCursor: null });
    const first = await syncHistory(start, fetch);
    const repeated = await syncHistory(first, fetch);
    expect(repeated.items.map((m) => m.sequence)).toEqual(messages(1, 50).map((m) => m.sequence));
  });

  it('loads earlier pages with their own cursor while retaining newer messages', async () => {
    const fetch = server(350);
    let current = await syncHistory(undefined, fetch);
    expect(current.beforeCursor).toBe('251');
    current = await syncHistory(current, server(370));
    current = await earlierHistory(current, fetch);
    expect(current.items.map((m) => m.sequence)).toEqual(messages(151, 370).map((m) => m.sequence));
    expect(current.beforeCursor).toBe('151');
    current = await earlierHistory(current, fetch);
    current = await earlierHistory(current, fetch);
    expect(current.items).toHaveLength(370);
    expect(current.beforeCursor).toBeNull();
  });

  it('merges overlapping older and newer requests without regressing either boundary', () => {
    const older: ChatHistory = {
      items: messages(51, 250),
      beforeCursor: '51',
      hasMoreAfter: false,
    };
    const newer: ChatHistory = {
      items: messages(151, 350),
      beforeCursor: '151',
      hasMoreAfter: true,
    };
    expect(mergeHistory(older, newer)).toEqual({
      items: messages(51, 350),
      beforeCursor: '51',
      hasMoreAfter: true,
    });
    expect(mergeHistory(newer, older)).toEqual({
      items: messages(51, 350),
      beforeCursor: '51',
      hasMoreAfter: true,
    });
  });
});
