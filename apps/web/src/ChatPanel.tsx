import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  api,
  useApi,
  useMe,
  useWords,
  usePreferences,
  useAction,
  usePagedApi,
  LoadMore,
  money,
  ErrorNotice,
  Empty,
  Loading,
  type Row,
} from './lib';
import { ChatComposer } from './ChatComposer';
import {
  syncHistory,
  earlierHistory,
  mergeHistory,
  type ChatHistory,
  type MessagePage,
} from './chat-history';

export function ChatPanel({ id }: { id?: string }) {
  const w = useWords();
  const me = useMe();
  const list = usePagedApi('/conversations?limit=20');
  return (
    <section className="page">
      <h1>{w('消息', 'Your conversations')}</h1>
      <div className={`chat-layout ${id ? 'has-thread' : 'no-thread'}`}>
        <aside className="panel conversation-list">
          {list.isPending && <Loading />}
          <ErrorNotice error={list.error} />
          {list.isError && (
            <button className="chip" disabled={list.isFetching} onClick={() => void list.refetch()}>
              {w('重试会话列表', 'Retry conversations')}
            </button>
          )}
          {list.data?.items?.map((c: Row) => (
            <Link
              key={c.id}
              to={`/messages/${c.id}`}
              className={c.id === id ? 'conversation selected' : 'conversation'}
            >
              <span className="avatar">{c.otherUser.nickname?.slice(0, 1)}</span>
              <div>
                <strong>{c.otherUser.nickname}</strong>
                <p>{c.listingSummary.title}</p>
              </div>
              {Number(c.unreadCount) > 0 && <span className="badge">{c.unreadCount}</span>}
            </Link>
          ))}
          {!list.isPending && !list.isError && !list.data?.items?.length && (
            <Empty
              text={w(
                '还没有会话，先从商品详情联系卖家。',
                'No conversations yet. Contact a seller from a listing.',
              )}
            />
          )}
          <LoadMore query={list} />
        </aside>
        <div className="panel chat-panel">
          {id && (
            <Link className="mobile-chat-back" to="/messages">
              ← {w('返回会话列表', 'Back to conversations')}
            </Link>
          )}
          {id && me.data?.id ? (
            <ConversationThread key={`${me.data.id}:${id}`} id={id} userId={me.data.id} />
          ) : (
            <Empty text={w('选择一个会话开始聊天', 'Choose a conversation')} />
          )}
        </div>
      </div>
    </section>
  );
}

function ConversationThread({ id, userId }: { id: string; userId: string }) {
  const w = useWords();
  const locale = usePreferences((s) => s.locale);
  const client = useQueryClient();
  const conv = useApi(`/conversations/${id}`);
  const action = useAction();
  const nav = useNavigate();
  const [location, setLocation] = useState('');
  const [when, setWhen] = useState('');
  const [olderPending, setOlderPending] = useState(false);
  const [olderError, setOlderError] = useState<unknown>(null);
  const [readError, setReadError] = useState<unknown>(null);
  const [readAttempt, setReadAttempt] = useState(0);
  const historyKey = [`/conversations/${id}/history`, userId];
  const fetchMessages = (query: string) =>
    api<MessagePage>(`/conversations/${id}/messages?${query}`);
  const history = useQuery({
    queryKey: historyKey,
    enabled: !!conv.data,
    queryFn: async () => {
      const updated = await syncHistory(
        client.getQueryData<ChatHistory>(historyKey),
        fetchMessages,
      );
      // An earlier-page fetch can finish while this refresh is in flight.
      return mergeHistory(client.getQueryData<ChatHistory>(historyKey), updated);
    },
  });
  const latest = history.data?.items.at(-1)?.id;
  useEffect(() => {
    if (!latest) return;
    let active = true;
    setReadError(null);
    void api(`/conversations/${id}/read`, 'POST', { lastReadMessageId: latest })
      .then(() => {
        if (!active) return;
        return client.invalidateQueries({
          predicate: (query) =>
            query.queryKey.some(
              (value) => typeof value === 'string' && /^\/conversations(?:\?|$)/.test(value),
            ),
        });
      })
      .catch((error: unknown) => {
        if (active) setReadError(error);
      });
    return () => {
      active = false;
    };
  }, [id, latest, readAttempt, client]);

  async function loadEarlier() {
    const current = client.getQueryData<ChatHistory>(historyKey);
    if (!current?.beforeCursor || olderPending) return;
    setOlderPending(true);
    setOlderError(null);
    try {
      const updated = await earlierHistory(current, fetchMessages);
      client.setQueryData<ChatHistory>(historyKey, (latestHistory) =>
        mergeHistory(latestHistory, updated),
      );
    } catch (error) {
      setOlderError(error);
    } finally {
      setOlderPending(false);
    }
  }

  if (conv.isPending) return <Loading />;
  const accessRevoked =
    conv.error instanceof Error &&
    ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'HTTP_401', 'HTTP_403', 'HTTP_404'].includes(
      conv.error.message,
    );
  if (!conv.data || accessRevoked)
    return (
      <>
        <ErrorNotice error={conv.error || new Error('NOT_FOUND')} />
        <button className="chip" disabled={conv.isFetching} onClick={() => void conv.refetch()}>
          {w('重试打开会话', 'Retry conversation')}
        </button>
      </>
    );
  const conversation = conv.data;
  return (
    <>
      <ErrorNotice error={conv.error} />
      {conv.isError && (
        <button className="chip" disabled={conv.isFetching} onClick={() => void conv.refetch()}>
          {w('重试打开会话', 'Retry conversation')}
        </button>
      )}
      <div className="chat-title">
        <strong>{conversation.otherUser.nickname}</strong>
        <Link to={`/listings/${conversation.listingId}`}>
          {conversation.listingSummary.title} · {money(conversation.listingSummary.priceMinor)}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          className="chip"
          disabled={history.isFetching}
          onClick={() => void history.refetch()}
        >
          {w('刷新消息', 'Refresh messages')}
        </button>
        {history.isFetching && (
          <small role="status">{w('正在同步消息…', 'Syncing messages…')}</small>
        )}
      </div>
      <ErrorNotice error={history.error} />
      {history.isError && (
        <button
          className="chip"
          disabled={history.isFetching}
          onClick={() => void history.refetch()}
        >
          {w('重试同步', 'Retry sync')}
        </button>
      )}
      <ErrorNotice error={readError} />
      {!!readError && (
        <button className="chip" onClick={() => setReadAttempt((n) => n + 1)}>
          {w('重试标记已读', 'Retry read marker')}
        </button>
      )}
      <div className="message-history" aria-label={w('聊天记录', 'Message history')}>
        {history.isPending && <Loading />}
        {history.data?.beforeCursor && (
          <button
            className="chip"
            disabled={olderPending || history.isFetching}
            onClick={() => void loadEarlier()}
          >
            {olderPending ? w('正在加载…', 'Loading…') : w('更早的消息', 'Earlier messages')}
          </button>
        )}
        <ErrorNotice error={olderError} />
        {!history.isPending && !history.isError && !history.data?.items.length && (
          <Empty
            text={w(
              '发送第一条消息，开始沟通吧。',
              'Send the first message to start the conversation.',
            )}
          />
        )}
        {history.data?.items.map((message) => (
          <div
            className={message.senderId === userId ? 'message mine' : 'message'}
            key={message.id}
          >
            <p>{message.body}</p>
            <small>
              {new Date(message.createdAt).toLocaleTimeString(locale, {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              {message.senderId === userId ? '✓' : ''}
            </small>
          </div>
        ))}
      </div>
      {history.data?.hasMoreAfter && (
        <div className="notice">
          <p>
            {w(
              '仍有未同步的新消息，请继续加载。',
              'More new messages are waiting. Continue syncing to catch up.',
            )}
          </p>
          <button
            className="chip"
            disabled={history.isFetching}
            onClick={() => void history.refetch()}
          >
            {w('继续同步新消息', 'Continue syncing')}
          </button>
        </div>
      )}
      <ChatComposer
        key={id}
        conversationId={id}
        locale={locale}
        send={async (body) => {
          await api(`/conversations/${id}/messages`, 'POST', body);
          // Sending has succeeded even if a subsequent history refresh is temporarily unavailable.
          void client.invalidateQueries({ queryKey: historyKey });
          void client.invalidateQueries({
            predicate: (query) =>
              query.queryKey.some(
                (value) => typeof value === 'string' && /^\/conversations(?:\?|$)/.test(value),
              ),
          });
        }}
      />
      {conversation.sellerId === userId && (
        <form
          className="reservation"
          onSubmit={(event) => {
            event.preventDefault();
            void action.run(async () => {
              const listing = await api(`/listings/${conversation.listingId}`);
              const trade = await api('/trades', 'POST', {
                conversationId: id,
                meetingLocation: location,
                meetingAt: new Date(when).toISOString(),
                expectedListingVersion: listing.contentVersion,
              });
              void nav({ to: `/trades/${trade.id}` });
            });
          }}
        >
          <h3>{w('为这位买家预约', 'Reserve for this buyer')}</h3>
          <div className="form-row">
            <input
              aria-label={w('面交地点', 'Meeting location')}
              placeholder={w('面交地点', 'Meeting location')}
              required
              maxLength={200}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
            <input
              aria-label={w('面交时间', 'Meeting time')}
              type="datetime-local"
              required
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
            <button className="btn" disabled={action.busy}>
              {w('预约', 'Reserve')}
            </button>
          </div>
          <ErrorNotice error={action.error} />
        </form>
      )}
    </>
  );
}
