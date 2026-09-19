import { useState } from 'react';
import { countCharacters, validMessage } from './chat-rules';
export function ChatComposer({
  locale,
  send,
  conversationId,
}: {
  locale: string;
  send: (body: Record<string, string>) => Promise<void>;
  conversationId?: string;
}) {
  return <Composer key={conversationId || 'conversation'} locale={locale} send={send} />;
}

function Composer({
  locale,
  send,
}: {
  locale: string;
  send: (body: Record<string, string>) => Promise<void>;
}) {
  const en = locale === 'en';
  const [text, setText] = useState('');
  const [template, setTemplate] = useState('');
  const [templateLocale, setTemplateLocale] = useState(locale);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<Record<string, string> | null>(null);
  const templates = [
    ['ASK_PRICE', en ? 'Ask price' : '问价格', en ? 'What is the price?' : '请问价格是多少？'],
    [
      'ASK_CONDITION',
      en ? 'Ask condition' : '问物品状态',
      en ? 'What condition is the item in?' : '请问物品现在是什么状态？',
    ],
    [
      'ASK_LOCATION',
      en ? 'Ask location' : '问交易地点',
      en ? 'Where can we meet?' : '请问在哪里交易？',
    ],
  ];
  async function submit(retry?: Record<string, string>) {
    const body = retry ?? {
      clientMessageId: crypto.randomUUID(),
      kind: template ? 'TEMPLATE' : 'TEXT',
      ...(template ? { templateCode: template, locale: templateLocale } : { text }),
    };
    setPending(true);
    try {
      await send(body);
      setText('');
      setTemplate('');
      setFailed(null);
    } catch {
      setFailed(body);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="composer">
      <div className="flex flex-wrap gap-2">
        {templates.map(([code, label, value]) => (
          <button
            key={code}
            disabled={pending || !!failed}
            className="chip"
            onClick={() => {
              setTemplate(code);
              setTemplateLocale(locale);
              setText(value);
            }}
          >
            {label}
          </button>
        ))}
        <button
          className="chip"
          disabled={pending || !!failed}
          onClick={() => {
            setTemplate('');
            setText('');
          }}
        >
          {en ? 'Free chat' : '自由聊天'}
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <input
          aria-label={en ? 'Message' : '消息'}
          placeholder={en ? 'Write a short message…' : '说点什么…'}
          value={text}
          disabled={pending || !!failed}
          onChange={(e) => {
            setText(e.target.value);
            setTemplate('');
          }}
        />
        <button
          className="btn"
          disabled={pending || !!failed || (!template && !validMessage(text))}
          onClick={() => void submit()}
        >
          {pending ? (en ? 'Sending…' : '发送中…') : en ? 'Send' : '发送'}
        </button>
      </div>
      <small className="muted">
        {template
          ? en
            ? 'Preset question · sent to the other person'
            : '快捷问题 · 发送给交易对方'
          : `${countCharacters(text)} / 20`}
      </small>
      {failed && (
        <div role="alert" className="notice error">
          {en ? 'Message not confirmed. Retry safely.' : '消息尚未确认发送成功，请重试。'}{' '}
          <button disabled={pending} onClick={() => void submit(failed)}>
            {en ? 'Retry' : '重试'}
          </button>
        </div>
      )}
    </div>
  );
}
