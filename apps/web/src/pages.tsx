import { useEffect, useState, FormEvent, ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  ArrowUpRight,
  Upload,
  MessageCircle,
  Check,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import {
  api,
  refreshCsrf,
  queryClient,
  useApi,
  useMe,
  usePreferences,
  useWords,
  useAction,
  ErrorNotice,
  Status,
  Loading,
  Empty,
  money,
  Row,
} from './lib';
import { ChatComposer } from './ChatComposer';
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Gate({ children }: { children: ReactNode }) {
  const me = useMe();
  const w = useWords();
  if (me.isPending) return <Loading />;
  if (!me.data)
    return (
      <section className="page payment">
        <h1>{w('先登录，再和邻居见面', 'Meet your neighbours. Sign in first.')}</h1>
        <Link to="/login" className="btn">
          {w('登录 / 注册', 'Sign in / Register')}
          <ArrowRight size={18} />
        </Link>
      </section>
    );
  return <>{children}</>;
}
export function Account() {
  const w = useWords();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const action = useAction();
  const nav = useNavigate();
  async function submit(e: FormEvent) {
    e.preventDefault();
    await action.run(async () => {
      if (register) await api('/auth/register', 'POST', { email, password, nickname });
      await api('/auth/login', 'POST', { email, password });
      await refreshCsrf();
      queryClient.removeQueries();
      void nav({ to: '/' });
    });
  }
  return (
    <section className="auth-layout">
      <div className="auth-story">
        <div className="eyebrow">WELCOME, NEIGHBOUR.</div>
        <h1>
          {w('让好物，', 'Good things.')}
          <br />
          {w('在校园相遇。', 'Great neighbours.')}
        </h1>
        <p>
          {w(
            '一段新故事，从认识身边的人开始。',
            'A new chapter starts with the people around you.',
          )}
        </p>
        <div className="auth-art">
          <BookOpen size={110} />
          <RefreshCw size={38} />
        </div>
      </div>
      <form className="panel auth-form" onSubmit={submit}>
        <h2>
          {register ? w('加入校园邻里', 'Join the neighbourhood') : w('欢迎回来', 'Welcome back')}
        </h2>
        <p className="muted">
          {w(
            '使用邮箱登录。当前不提供学校认证。',
            'Sign in with email. Campus identity is not verified.',
          )}
        </p>
        {register && (
          <Field label={w('昵称', 'Nickname')}>
            <input
              required
              maxLength={40}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </Field>
        )}
        <Field label={w('邮箱', 'Email')}>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label={w('密码（12–128字符）', 'Password (12–128 characters)')}>
          <input
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            minLength={12}
            maxLength={128}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorNotice error={action.error} />
        <button className="btn wide" disabled={action.busy}>
          {register ? w('创建账号', 'Create account') : w('登录', 'Sign in')}
          <ArrowRight size={17} />
        </button>
        <button className="text-btn" type="button" onClick={() => setRegister(!register)}>
          {register
            ? w('已有账号？登录', 'Already a member? Sign in')
            : w('还没有账号？立即注册', 'New here? Create an account')}
        </button>
      </form>
    </section>
  );
}
export function Editor({ id }: { id?: string }) {
  return (
    <Gate>
      <EditorForm id={id} />
    </Gate>
  );
}
function EditorForm({ id }: { id?: string }) {
  const w = useWords();
  const locale = usePreferences((s) => s.locale);
  const nav = useNavigate();
  const existing = useApi('/listings/' + id, !!id);
  const cats = useApi('/dictionaries/categories');
  const halls = useApi('/dictionaries/buildings');
  const courses = useApi('/dictionaries/courses');
  const action = useAction();
  const [form, setForm] = useState<Row>({
    title: '',
    description: '',
    price: '',
    categoryId: '',
    buildingId: '',
    courseId: '',
    conditionCode: 'GOOD',
    bookAuthor: '',
    bookEdition: '',
    swapEnabled: false,
    wantedDescription: '',
  });
  const [images, setImages] = useState<Row[]>([]);
  useEffect(() => {
    if (existing.data) {
      const d = existing.data;
      setForm({
        ...d,
        price: String(d.priceMinor / 100),
        courseId: d.courseId || '',
        bookAuthor: d.bookAuthor || '',
        bookEdition: d.bookEdition || '',
        wantedDescription: d.wantedDescription || '',
      });
      setImages(d.images || []);
    }
  }, [existing.data]);
  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));
  const opts = (q: Row | undefined) =>
    q?.items?.map((d: Row) => (
      <option key={d.id} value={d.id}>
        {d[locale === 'en' ? 'nameEn' : 'nameZh']}
      </option>
    ));
  async function submit(e: FormEvent) {
    e.preventDefault();
    void action.run(async () => {
      const body = {
        title: form.title,
        description: form.description,
        priceMinor: Math.round(Number(form.price) * 100),
        categoryId: form.categoryId,
        buildingId: form.buildingId,
        courseId: form.courseId || null,
        conditionCode: form.conditionCode,
        bookAuthor: form.bookAuthor || null,
        bookEdition: form.bookEdition || null,
        swapEnabled: form.swapEnabled,
        wantedDescription: form.wantedDescription || null,
        imageIds: images.map((i) => i.id),
        ...(id ? { expectedVersion: form.contentVersion } : {}),
      };
      const saved = await api(id ? '/listings/' + id : '/listings', id ? 'PATCH' : 'POST', body);
      void nav({ to: '/listings/' + saved.id });
    });
  }
  return (
    <section className="page narrow">
      <div className="eyebrow">GIVE IT A NEW CHAPTER</div>
      <h1>
        {id ? w('编辑商品', 'Edit your listing') : w('发布一件闲置', 'List something lovely')}
      </h1>
      <p className="muted">
        {w(
          '真实描述、清晰照片，让下一位主人更了解它。',
          'Clear photos and honest details make a better match.',
        )}
      </p>
      <ErrorNotice error={existing.error} />
      <form className="panel form-grid" onSubmit={submit}>
        <Field label={w('商品标题', 'Title')}>
          <input
            required
            maxLength={80}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>
        <Field label={w('描述', 'Description')}>
          <textarea
            required
            maxLength={2000}
            rows={4}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>
        <div className="form-row">
          <Field label={w('价格（元）', 'Price (CNY)')}>
            <input
              type="number"
              min="0"
              max="9999999.99"
              step="0.01"
              required
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
            />
          </Field>
          <Field label={w('成色', 'Condition')}>
            <select
              value={form.conditionCode}
              onChange={(e) => set('conditionCode', e.target.value)}
            >
              {[
                ['NEW', w('全新', 'New')],
                ['LIKE_NEW', w('几乎全新', 'Like new')],
                ['GOOD', w('状态良好', 'Good')],
                ['FAIR', w('正常使用', 'Fair')],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label={w('分类', 'Category')}>
            <select
              required
              value={form.categoryId}
              onChange={(e) => set('categoryId', e.target.value)}
            >
              <option value="">{w('请选择', 'Choose…')}</option>
              {opts(cats.data)}
            </select>
          </Field>
          <Field label={w('楼栋 / 校园地点', 'Hall / campus location')}>
            <select
              required
              value={form.buildingId}
              onChange={(e) => set('buildingId', e.target.value)}
            >
              <option value="">{w('请选择', 'Choose…')}</option>
              {opts(halls.data)}
            </select>
          </Field>
        </div>
        <div className="upload-area">
          <label>
            <Upload size={24} />
            <strong>{w('添加商品照片（1–6张）', 'Add photos (1–6)')}</strong>
            <span>PNG / JPEG · ≤5 MiB</span>
            <input
              aria-label={w('上传图片', 'Upload photos')}
              type="file"
              accept="image/png,image/jpeg"
              multiple
              disabled={action.busy}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                void action.run(async () => {
                  if (files.length + images.length > 6) throw new Error('VALIDATION_ERROR');
                  for (const file of files) {
                    const data = new FormData();
                    data.append('file', file);
                    const i = await api('/images', 'POST', data);
                    setImages((old) => [...old, i]);
                  }
                });
              }}
            />
          </label>
          <div className="thumbs">
            {images.map((i) => (
              <button
                type="button"
                key={i.id}
                title={w('移除', 'Remove')}
                onClick={() => setImages(images.filter((x) => x.id !== i.id))}
              >
                <img src={i.url} alt="" />
                <span>×</span>
              </button>
            ))}
          </div>
        </div>
        <h3>{w('校园与教材信息', 'Campus & textbook details')}</h3>
        <Field label={w('关联课程（选填）', 'Course (optional)')}>
          <select value={form.courseId} onChange={(e) => set('courseId', e.target.value)}>
            <option value="">{w('未关联', 'No course')}</option>
            {opts(courses.data)}
          </select>
        </Field>
        <div className="form-row">
          <Field label={w('作者', 'Author')}>
            <input
              maxLength={100}
              value={form.bookAuthor}
              onChange={(e) => set('bookAuthor', e.target.value)}
            />
          </Field>
          <Field label={w('教材版本', 'Edition')}>
            <input
              maxLength={100}
              value={form.bookEdition}
              onChange={(e) => set('bookEdition', e.target.value)}
            />
          </Field>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={form.swapEnabled}
            onChange={(e) => set('swapEnabled', e.target.checked)}
          />
          {w('也愿意以物换物', 'I am open to a swap')}
        </label>
        {form.swapEnabled && (
          <Field label={w('希望换得什么？', 'What would you like in return?')}>
            <input
              maxLength={500}
              value={form.wantedDescription}
              onChange={(e) => set('wantedDescription', e.target.value)}
            />
          </Field>
        )}
        <ErrorNotice error={action.error} />
        <button className="btn" disabled={action.busy || !images.length}>
          {action.busy ? w('处理中…', 'Working…') : w('保存并查看', 'Save & view listing')}
          <ArrowUpRight size={18} />
        </button>
        {id && ['AVAILABLE', 'WITHDRAWN'].includes(form.status) && (
          <button
            type="button"
            className="btn secondary"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await api(
                  `/listings/${id}/${form.status === 'AVAILABLE' ? 'withdraw' : 'relist'}`,
                  'POST',
                  { expectedVersion: form.contentVersion },
                );
                void nav({ to: '/mine' });
              })
            }
          >
            {form.status === 'AVAILABLE'
              ? w('下架商品', 'Withdraw listing')
              : w('重新上架', 'Relist item')}
          </button>
        )}
      </form>
    </section>
  );
}
export function Profile({ id }: { id?: string }) {
  return id ? (
    <ProfileForm id={id} />
  ) : (
    <Gate>
      <ProfileForm />
    </Gate>
  );
}
function ProfileForm({ id }: { id?: string }) {
  const w = useWords();
  const me = useMe();
  const q = useApi('/users/' + id + '/profile', !!id);
  const courses = useApi('/dictionaries/courses');
  const reviews = useApi('/users/' + (id || me.data?.id) + '/reviews', !!(id || me.data?.id));
  const action = useAction();
  const [form, setForm] = useState<Row>({
    nickname: '',
    college: '',
    major: '',
    year: '',
    bio: '',
    courses: [],
  });
  const own = !id || id === me.data?.id;
  useEffect(() => {
    const p = id ? q.data : me.data?.profile;
    if (p) setForm({ ...p, courses: p.courses || [] });
  }, [q.data, me.data?.profile, id]);
  const fields = [
    ['nickname', w('昵称', 'Nickname'), 40],
    ['college', w('学院', 'College'), 100],
    ['major', w('专业', 'Major'), 100],
    ['year', w('年级', 'Year'), 20],
    ['bio', w('简介', 'About you'), 500],
  ] as const;
  return (
    <section className="page narrow">
      <h1>{own ? w('我的校园名片', 'Your campus profile') : form.nickname}</h1>
      <p className="muted">
        {w(
          '学院、专业和课程背景为自愿填写，非学校认证信息。',
          'Academic details are optional and self-reported.',
        )}
      </p>
      <ErrorNotice error={q.error} />
      <form
        className="panel form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            const body: Row = { courses: form.courses };
            fields.forEach(([k]) => (body[k] = form[k] || null));
            await api('/me/profile', 'PATCH', body);
          });
        }}
      >
        {fields.map(([key, label, max]) => (
          <Field key={key} label={label}>
            <input
              readOnly={!own}
              required={key === 'nickname'}
              maxLength={max}
              value={form[key] || ''}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </Field>
        ))}
        <h3>{w('课程背景', 'Course background')}</h3>
        {form.courses.map((c: Row, n: number) => (
          <div className="course-row" key={n}>
            <select
              disabled={!own}
              value={c.courseId}
              onChange={(e) =>
                setForm({
                  ...form,
                  courses: form.courses.map((x: Row, i: number) =>
                    i === n ? { ...x, courseId: e.target.value } : x,
                  ),
                })
              }
            >
              {courses.data?.items?.map((x: Row) => (
                <option key={x.id} value={x.id}>
                  {x.nameZh} / {x.nameEn}
                </option>
              ))}
            </select>
            <input
              readOnly={!own}
              placeholder={w('任课老师', 'Teacher')}
              value={c.teacher || ''}
              maxLength={100}
              onChange={(e) =>
                setForm({
                  ...form,
                  courses: form.courses.map((x: Row, i: number) =>
                    i === n ? { ...x, teacher: e.target.value } : x,
                  ),
                })
              }
            />
            <input
              readOnly={!own}
              placeholder={w('课程简述', 'Course description')}
              value={c.description || ''}
              maxLength={500}
              onChange={(e) =>
                setForm({
                  ...form,
                  courses: form.courses.map((x: Row, i: number) =>
                    i === n ? { ...x, description: e.target.value } : x,
                  ),
                })
              }
            />
            {own && (
              <button
                type="button"
                className="text-btn"
                onClick={() =>
                  setForm({ ...form, courses: form.courses.filter((_: Row, i: number) => i !== n) })
                }
              >
                ×
              </button>
            )}
          </div>
        ))}
        {own && (
          <>
            <button
              type="button"
              className="chip"
              onClick={() => {
                if (courses.data?.items?.length)
                  setForm({
                    ...form,
                    courses: [
                      ...form.courses,
                      { courseId: courses.data.items[0].id, teacher: '', description: '' },
                    ],
                  });
              }}
            >
              {w('添加课程', 'Add course')}
            </button>
            <ErrorNotice error={action.error} />
            <button className="btn" disabled={action.busy}>
              {w('保存资料', 'Save profile')}
            </button>
          </>
        )}
      </form>
      <h2 className="mt-8">{w('交易评价', 'Trade reviews')}</h2>
      {reviews.data?.items?.map((r: Row) => (
        <div className="panel" key={r.id}>
          <strong>
            {r.nickname} · {'★'.repeat(r.rating)}
          </strong>
          <p>{r.comment}</p>
        </div>
      ))}
      {!reviews.data?.items?.length && <Empty text={w('还没有评价', 'No reviews yet')} />}
    </section>
  );
}
export function Messages({ id }: { id?: string }) {
  return (
    <Gate>
      <MessageBoard id={id} />
    </Gate>
  );
}
function MessageBoard({ id }: { id?: string }) {
  const w = useWords();
  const locale = usePreferences((s) => s.locale);
  const me = useMe();
  const list = useApi('/conversations');
  const history = useApi(`/conversations/${id}/messages?limit=100`, !!id);
  const conv = list.data?.items?.find((c: Row) => c.id === id);
  const action = useAction();
  const nav = useNavigate();
  const [location, setLocation] = useState('');
  const [when, setWhen] = useState('');
  const [older, setOlder] = useState<Row[]>([]);
  const [before, setBefore] = useState<string | null>(null);
  useEffect(() => {
    setOlder([]);
    setBefore(null);
  }, [id]);
  useEffect(() => {
    const items = history.data?.items;
    if (id && items?.length)
      void api(`/conversations/${id}/read`, 'POST', {
        lastReadMessageId: items[items.length - 1].id,
      });
  }, [id, history.data]);
  return (
    <section className="page">
      <h1>{w('消息', 'Your conversations')}</h1>
      <div className="chat-layout">
        <aside className="panel conversation-list">
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
          {!list.data?.items?.length && <Empty />}
        </aside>
        <div className="panel chat-panel">
          {id && conv ? (
            <>
              <div className="chat-title">
                <strong>{conv.otherUser.nickname}</strong>
                <Link to={`/listings/${conv.listingId}`}>
                  {conv.listingSummary.title} · {money(conv.listingSummary.priceMinor)}
                </Link>
              </div>
              <ErrorNotice error={history.error} />
              <div className="message-history">
                {(before === null ? history.data?.nextCursor : before) && (
                  <button
                    className="chip"
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(async () => {
                        const result = await api(
                          `/conversations/${id}/messages?beforeCursor=${before || history.data?.nextCursor}&limit=100`,
                        );
                        setOlder((prev) => [...result.items, ...prev]);
                        setBefore(result.nextCursor || '');
                      })
                    }
                  >
                    {w('更早的消息', 'Earlier messages')}
                  </button>
                )}
                {[...older, ...(history.data?.items || [])].map((m: Row) => (
                  <div
                    className={m.senderId === me.data?.id ? 'message mine' : 'message'}
                    key={m.id}
                  >
                    <p>{m.body}</p>
                    <small>
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      {m.senderId === me.data?.id ? '✓' : ''}
                    </small>
                  </div>
                ))}
              </div>
              <ChatComposer
                locale={locale}
                send={async (b) => {
                  await api(`/conversations/${id}/messages`, 'POST', b);
                  await queryClient.invalidateQueries({
                    queryKey: [`/conversations/${id}/messages?limit=100`],
                  });
                }}
              />
              {conv.sellerId === me.data?.id && (
                <form
                  className="reservation"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action.run(async () => {
                      const l = await api('/listings/' + conv.listingId);
                      const t = await api('/trades', 'POST', {
                        conversationId: id,
                        meetingLocation: location,
                        meetingAt: new Date(when).toISOString(),
                        expectedListingVersion: l.contentVersion,
                      });
                      void nav({ to: '/trades/' + t.id });
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
                      onChange={(e) => setLocation(e.target.value)}
                    />
                    <input
                      aria-label={w('面交时间', 'Meeting time')}
                      type="datetime-local"
                      required
                      value={when}
                      onChange={(e) => setWhen(e.target.value)}
                    />
                    <button className="btn" disabled={action.busy}>
                      {w('预约', 'Reserve')}
                    </button>
                  </div>
                  <ErrorNotice error={action.error} />
                </form>
              )}
            </>
          ) : (
            <Empty text={w('选择一个会话开始聊天', 'Choose a conversation')} />
          )}
        </div>
      </div>
    </section>
  );
}
export function Trades({ id }: { id?: string }) {
  return (
    <Gate>
      <TradeBoard id={id} />
    </Gate>
  );
}
function TradeBoard({ id }: { id?: string }) {
  const w = useWords();
  const q = useApi(id ? '/trades/' + id : '/trades');
  const me = useMe();
  const action = useAction();
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  if (q.isPending) return <Loading />;
  return (
    <section className="page narrow">
      <h1>{w('我的交易', 'Your trades')}</h1>
      <ErrorNotice error={q.error} />
      <ErrorNotice error={action.error} />
      {!id ? (
        <div className="stack">
          {q.data?.items?.map((t: Row) => (
            <Link to={`/trades/${t.id}`} className="panel trade-card" key={t.id}>
              <div>
                <Status value={t.status} />
                <h3>{t.items?.map((i: Row) => i.snapshot.title).join(' ↔ ')}</h3>
                <p>
                  {t.meetingLocation} · {new Date(t.meetingAt).toLocaleString()}
                </p>
              </div>
              <ArrowUpRight />
            </Link>
          ))}
          {!q.data?.items?.length && <Empty />}
        </div>
      ) : (
        q.data &&
        (() => {
          const t = q.data;
          const confirmed = t.confirmations?.some((c: Row) => c.userId === me.data?.id);
          const receiver = t.items?.some((i: Row) => i.receiverId === me.data?.id);
          return (
            <div className="panel form-grid">
              <div className="flex justify-between">
                <Status value={t.status} />
                <span className="muted">
                  {t.kind === 'SWAP' ? w('以物换物', 'Swap') : w('二手交易', 'Sale')}
                </span>
              </div>
              {t.items?.map((i: Row) => (
                <div className="trade-item" key={i.listingId}>
                  <strong>{i.snapshot.title}</strong>
                  <span>{money(i.snapshot.priceMinor)}</span>
                </div>
              ))}
              <p>
                {w('面交地点', 'Meeting at')}: {t.meetingLocation}
                <br />
                {new Date(t.meetingAt).toLocaleString()}
              </p>
              <ol className="timeline">
                <li>{w('预约已建立', 'Reservation created')}</li>
                <li>{w('线下面交，检查物品', 'Meet and inspect the item')}</li>
                <li>
                  {t.status === 'COMPLETED'
                    ? w('交易已完成', 'Trade completed')
                    : w('等待收货确认', 'Awaiting receipt confirmation')}
                </li>
              </ol>
              {['WAITING_MEETUP', 'PARTIALLY_CONFIRMED'].includes(t.status) &&
                receiver &&
                !confirmed && (
                  <button
                    className="btn"
                    disabled={action.busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          w(
                            '确认已经收到并检查过物品？这不会处理任何付款。',
                            'Have you received and inspected the item? This does not process payment.',
                          ),
                        )
                      )
                        void action.run(() => api(`/trades/${id}/confirm-receipt`, 'POST', {}));
                    }}
                  >
                    <Check size={18} />
                    {w('确认收货', 'Confirm receipt')}
                  </button>
                )}
              {confirmed && t.status !== 'COMPLETED' && (
                <div className="notice">
                  {w(
                    '你已确认，等待另一方确认。',
                    'You confirmed. Waiting for the other participant.',
                  )}
                </div>
              )}
              {t.status === 'WAITING_MEETUP' && (
                <form
                  className="form-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action.run(() => api(`/trades/${id}/cancel`, 'POST', { reason }));
                  }}
                >
                  <input
                    required
                    aria-label={w('取消原因', 'Cancellation reason')}
                    maxLength={300}
                    placeholder={w('取消原因', 'Cancellation reason')}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <button className="btn secondary" disabled={action.busy}>
                    {w('取消预约', 'Cancel reservation')}
                  </button>
                </form>
              )}
              <Link to="/payment-unavailable" className="text-btn">
                {w('Pay · 支付入口展示', 'Pay · payment preview')} ↗
              </Link>
              {t.status === 'COMPLETED' &&
                !t.reviews?.some((r: Row) => r.authorId === me.data?.id) && (
                  <form
                    className="form-grid"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action.run(() =>
                        api(`/trades/${id}/reviews`, 'POST', { rating: Number(rating), comment }),
                      );
                    }}
                  >
                    <h3>{w('给对方一个评价', 'Leave a review')}</h3>
                    <select
                      aria-label={w('评分', 'Rating')}
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {'★'.repeat(n)}
                        </option>
                      ))}
                    </select>
                    <textarea
                      aria-label={w('评价内容', 'Review')}
                      maxLength={300}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <button className="btn" disabled={action.busy}>
                      {w('提交评价', 'Submit review')}
                    </button>
                  </form>
                )}
              {t.reviews?.map((r: Row) => (
                <div className="notice" key={r.id}>
                  <strong>
                    {r.nickname} · {'★'.repeat(r.rating)}
                  </strong>
                  <p>{r.comment}</p>
                </div>
              ))}
            </div>
          );
        })()
      )}
    </section>
  );
}
export function Swaps() {
  return (
    <Gate>
      <SwapBoard />
    </Gate>
  );
}
function SwapBoard() {
  const w = useWords();
  const me = useMe();
  const mine = useApi('/me/listings?status=AVAILABLE');
  const others = useApi('/listings?swapEnabled=true&limit=100');
  const requests = useApi('/swap-requests');
  const [offered, setOffered] = useState('');
  const [requested, setRequested] = useState(
    new URLSearchParams(location.search).get('listingId') || '',
  );
  const [place, setPlace] = useState('');
  const [date, setDate] = useState('');
  const action = useAction();
  return (
    <section className="page narrow">
      <div className="eyebrow">SOMETHING FOR SOMETHING</div>
      <h1>{w('交换好物，也交换故事', 'A good exchange.')}</h1>
      <p className="muted">
        {w(
          '一件换一件，无补差价。双方接受后再约见。',
          'One item for one item. No cash top-ups. Meet after both agree.',
        )}
      </p>
      <form
        className="panel form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            const a = await api('/listings/' + offered),
              b = await api('/listings/' + requested);
            await api('/swap-requests', 'POST', {
              offeredListingId: offered,
              requestedListingId: requested,
              offeredVersion: a.contentVersion,
              requestedVersion: b.contentVersion,
              meetingLocation: place,
              meetingAt: new Date(date).toISOString(),
            });
          });
        }}
      >
        <div className="form-row">
          <Field label={w('我提供', 'I offer')}>
            <select required value={offered} onChange={(e) => setOffered(e.target.value)}>
              <option value="">{w('选择我的商品', 'Choose your item')}</option>
              {mine.data?.items
                ?.filter((i: Row) => i.swapEnabled)
                .map((i: Row) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={w('我想换得', 'In exchange for')}>
            <select required value={requested} onChange={(e) => setRequested(e.target.value)}>
              <option value="">{w('选择对方商品', 'Choose another item')}</option>
              {others.data?.items
                ?.filter((i: Row) => i.ownerId !== me.data?.id)
                .map((i: Row) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label={w('面交地点', 'Meeting location')}>
            <input
              required
              maxLength={200}
              value={place}
              onChange={(e) => setPlace(e.target.value)}
            />
          </Field>
          <Field label={w('面交时间', 'Meeting time')}>
            <input
              type="datetime-local"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <button className="btn" disabled={action.busy}>
          <RefreshCw size={18} />
          {w('发起换物请求', 'Propose swap')}
        </button>
        <ErrorNotice error={action.error} />
      </form>
      <h2 className="mt-8">{w('我的换物请求', 'Your swap requests')}</h2>
      <div className="stack">
        {requests.data?.items?.map((s: Row) => (
          <div key={s.id} className="panel">
            <Status value={s.status} />
            <div className="flex gap-3 mt-3">
              <Link to={`/listings/${s.offeredListingId}`}>
                {w('查看提供商品', 'Offered item')} ↗
              </Link>
              <span>↔</span>
              <Link to={`/listings/${s.requestedListingId}`}>
                {w('查看目标商品', 'Requested item')} ↗
              </Link>
            </div>
            <p>
              {s.meetingLocation} · {new Date(s.meetingAt).toLocaleString()}
            </p>
            <div className="flex gap-2">
              {s.status === 'PENDING' &&
                (s.recipientId === me.data?.id ? ['accept', 'reject'] : ['withdraw']).map((v) => (
                  <button
                    disabled={action.busy}
                    key={v}
                    className="chip"
                    onClick={() =>
                      void action.run(() => api(`/swap-requests/${s.id}/${v}`, 'POST', {}))
                    }
                  >
                    {w(
                      (
                        { accept: '接受', reject: '拒绝', withdraw: '撤回' } as Record<
                          string,
                          string
                        >
                      )[v],
                      v,
                    )}
                  </button>
                ))}
              {s.tradeId && (
                <Link className="btn" to={`/trades/${s.tradeId}`}>
                  {w('查看交换交易', 'View swap trade')}
                  <ArrowRight size={16} />
                </Link>
              )}
            </div>
          </div>
        ))}
        {!requests.data?.items?.length && <Empty />}
      </div>
    </section>
  );
}
export function Notifications() {
  const w = useWords();
  const q = useApi('/notifications');
  const action = useAction();
  return (
    <Gate>
      <section className="page narrow">
        <h1>{w('通知', 'Notifications')}</h1>
        <ErrorNotice error={q.error || action.error} />
        <div className="stack">
          {q.data?.items?.map((n: Row) => (
            <div className="panel flex justify-between items-center" key={n.id}>
              <Link
                to={`/${n.resourceType === 'conversation' ? 'messages' : n.resourceType === 'swap' ? 'swaps' : 'trades'}${n.resourceType === 'swap' ? '' : '/' + n.resourceId}`}
                onClick={() =>
                  void action.run(() => api(`/notifications/${n.id}/read`, 'POST', {}))
                }
              >
                <strong>
                  {w(
                    (
                      {
                        MESSAGE_CREATED: '收到新消息',
                        TRADE_CHANGED: '交易状态更新',
                        SWAP_REQUESTED: '收到换物请求',
                      } as Record<string, string>
                    )[n.type] || '有新动态',
                    n.type.replaceAll('_', ' ').toLowerCase(),
                  )}
                </strong>
                <p className="muted">{new Date(n.createdAt).toLocaleString()}</p>
              </Link>
              {!n.readAt && <span className="online-dot" />}
            </div>
          ))}
          {!q.data?.items?.length && <Empty />}
        </div>
      </section>
    </Gate>
  );
}
export function Admin() {
  return (
    <Gate>
      <AdminBoard />
    </Gate>
  );
}
function AdminBoard() {
  const w = useWords();
  const me = useMe();
  const [tab, setTab] = useState('listings');
  const [kind, setKind] = useState('buildings');
  const path = tab === 'dictionaries' ? `/admin/dictionaries/${kind}` : `/admin/${tab}`;
  const q = useApi(path, me.data?.role === 'ADMIN');
  const action = useAction();
  const [zh, setZh] = useState('');
  const [en, setEn] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  if (me.data?.role !== 'ADMIN') return <ErrorNotice error="FORBIDDEN" />;
  return (
    <section className="page">
      <h1>{w('校园管理', 'Campus administration')}</h1>
      <div className="categories mb-6">
        {[
          ['listings', w('商品', 'Listings')],
          ['users', w('账号', 'Accounts')],
          ['dictionaries', w('校园字典', 'Campus dictionaries')],
          ['zones', w('季节专区', 'Collections')],
          ['audit-logs', w('处理记录', 'Audit log')],
        ].map(([v, l]) => (
          <button
            key={v}
            className={tab === v ? 'chip selected' : 'chip'}
            onClick={() => setTab(v)}
          >
            {l}
          </button>
        ))}
      </div>
      <ErrorNotice error={q.error || action.error} />
      {(tab === 'zones' || tab === 'dictionaries') && (
        <form
          className="panel form-grid mb-6"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await api(
                path,
                'POST',
                tab === 'zones'
                  ? {
                      titleZh: zh,
                      titleEn: en,
                      startsAt: new Date(start).toISOString(),
                      endsAt: new Date(end).toISOString(),
                      enabled: true,
                    }
                  : { nameZh: zh, nameEn: en, active: true },
              );
              setZh('');
              setEn('');
            });
          }}
        >
          {tab === 'dictionaries' && (
            <select
              aria-label={w('字典类型', 'Dictionary type')}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {[
                ['buildings', w('楼栋', 'Buildings')],
                ['courses', w('课程', 'Courses')],
                ['categories', w('分类', 'Categories')],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          )}
          <div className="form-row">
            <Field label={w('中文名称', 'Chinese name')}>
              <input required maxLength={100} value={zh} onChange={(e) => setZh(e.target.value)} />
            </Field>
            <Field label={w('英文名称', 'English name')}>
              <input required maxLength={100} value={en} onChange={(e) => setEn(e.target.value)} />
            </Field>
          </div>
          {tab === 'zones' && (
            <div className="form-row">
              <Field label={w('开始', 'Starts')}>
                <input
                  required
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field label={w('结束', 'Ends')}>
                <input
                  required
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </Field>
            </div>
          )}
          <button className="btn" disabled={action.busy}>
            {w('新增', 'Create')}
          </button>
        </form>
      )}
      <div className="stack">
        {q.data?.items?.map((row: Row) => (
          <div className="panel admin-row" key={row.id}>
            <div>
              <strong>
                {row.title || row.nickname || row.nameZh || row.titleZh || row.action}
              </strong>
              <p className="muted">{row.reason || row.nameEn || row.titleEn || row.id}</p>
            </div>
            {row.status && <Status value={row.status} />}
            <div className="flex gap-2">
              {(tab === 'listings' || tab === 'users') && (
                <button
                  className="chip"
                  disabled={action.busy}
                  onClick={() => {
                    const reason = prompt(w('请输入处理理由', 'Reason for this action'));
                    if (reason)
                      void action.run(() =>
                        api(
                          tab === 'users'
                            ? `/admin/users/${row.id}/restriction`
                            : `/admin/listings/${row.id}/moderation`,
                          'POST',
                          tab === 'users'
                            ? { restricted: row.status !== 'RESTRICTED', reason }
                            : {
                                action: row.moderationStatus === 'HIDDEN' ? 'RESTORE' : 'HIDE',
                                reason,
                              },
                        ),
                      );
                  }}
                >
                  {tab === 'users'
                    ? row.status === 'RESTRICTED'
                      ? w('恢复', 'Restore')
                      : w('限制', 'Restrict')
                    : row.moderationStatus === 'HIDDEN'
                      ? w('恢复展示', 'Restore visibility')
                      : w('隐藏商品', 'Hide listing')}
                </button>
              )}
              {tab === 'dictionaries' && (
                <button
                  className="chip"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(() =>
                      api(`${path}/${row.id}`, 'PATCH', {
                        nameZh: row.nameZh,
                        nameEn: row.nameEn,
                        active: !row.active,
                      }),
                    )
                  }
                >
                  {row.active ? w('停用', 'Disable') : w('启用', 'Enable')}
                </button>
              )}
              {tab === 'zones' && (
                <button
                  className="chip"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(() =>
                      api(`${path}/${row.id}`, 'PATCH', {
                        titleZh: row.titleZh,
                        titleEn: row.titleEn,
                        startsAt: row.startsAt,
                        endsAt: row.endsAt,
                        enabled: !row.enabled,
                      }),
                    )
                  }
                >
                  {row.enabled ? w('停用', 'Disable') : w('启用', 'Enable')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
