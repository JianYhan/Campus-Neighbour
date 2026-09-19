export type ChatMessage = {
  id: string;
  sequence: number;
  senderId: string;
  body: string;
  createdAt: string;
};
export type MessagePage = { items: ChatMessage[]; nextCursor: string | null };
export type ChatHistory = {
  items: ChatMessage[];
  beforeCursor: string | null;
  hasMoreAfter: boolean;
};
export type HistoryFetcher = (query: string) => Promise<MessagePage>;

function ordered(items: ChatMessage[]) {
  return [...new Map(items.map((message) => [message.id, message])).values()].sort(
    (a, b) => a.sequence - b.sequence,
  );
}

function newest(history: ChatHistory) {
  return history.items.reduce((maximum, message) => Math.max(maximum, message.sequence), 0);
}

export async function syncHistory(
  previous: ChatHistory | undefined,
  fetchPage: HistoryFetcher,
  maxPages = 3,
): Promise<ChatHistory> {
  if (!previous) {
    const page = await fetchPage('limit=100');
    return { items: ordered(page.items), beforeCursor: page.nextCursor, hasMoreAfter: false };
  }
  let result = previous;
  for (let pageIndex = 0; pageIndex < Math.max(1, maxPages); pageIndex += 1) {
    const cursor = newest(result);
    const page = await fetchPage(`afterCursor=${cursor}&limit=100`);
    result = {
      ...result,
      items: ordered([...result.items, ...page.items]),
      hasMoreAfter: page.nextCursor !== null,
    };
    if (!result.hasMoreAfter) break;
    // A broken/stale cursor must not make a repeated request loop or silently skip records.
    if (newest(result) <= cursor) throw new Error('HISTORY_CURSOR_STALLED');
  }
  return result;
}

export async function earlierHistory(
  previous: ChatHistory,
  fetchPage: HistoryFetcher,
): Promise<ChatHistory> {
  if (previous.beforeCursor === null) return previous;
  const page = await fetchPage(
    `beforeCursor=${encodeURIComponent(previous.beforeCursor)}&limit=100`,
  );
  return {
    ...previous,
    items: ordered([...page.items, ...previous.items]),
    beforeCursor: page.nextCursor,
  };
}

export function mergeHistory(
  previous: ChatHistory | undefined,
  incoming: ChatHistory,
): ChatHistory {
  if (!previous) return incoming;
  return {
    items: ordered([...previous.items, ...incoming.items]),
    beforeCursor:
      previous.beforeCursor === null || incoming.beforeCursor === null
        ? null
        : String(Math.min(Number(previous.beforeCursor), Number(incoming.beforeCursor))),
    hasMoreAfter:
      newest(incoming) >= newest(previous) ? incoming.hasMoreAfter : previous.hasMoreAfter,
  };
}
