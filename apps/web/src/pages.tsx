import { useEffect, useState, useRef, FormEvent, ReactNode } from 'react';
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
  usePagedApi,
  LoadMore,
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
import { ChatPanel } from './ChatPanel';
import { AdminPanel } from './AdminPanel';
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
      <EditorForm key={id || 'new'} id={id} />
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
  const initialized = useRef(false);
  useEffect(() => {
    if (existing.data && !initialized.current) {
      initialized.current = true;
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
      <ErrorNotice error={existing.error || cats.error || halls.error || courses.error} />
      {id && existing.isPending && <Loading />}
      <form className="panel form-grid" onSubmit={submit}>
        <fieldset className="form-fields" disabled={action.busy || (!!id && !existing.data)}>
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
        </fieldset>
      </form>
    </section>
  );
}
export function Profile({ id }: { id?: string }) {
  return id ? (
    <ProfileForm key={id} id={id} />
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
  const reviews = usePagedApi('/users/' + (id || me.data?.id) + '/reviews', !!(id || me.data?.id));
  const action = useAction();
  const [form, setForm] = useState<Row>({
    nickname: '',
    college: '',
    major: '',
    year: '',
    bio: '',
    courses: [],
  });
  const initialized = useRef(false);
  const [saved, setSaved] = useState(false);
  const own = !id || id === me.data?.id;
  useEffect(() => {
    const p = id ? q.data : me.data?.profile;
    if (p && !initialized.current) {
      initialized.current = true;
      setForm({ ...p, courses: p.courses || [] });
    }
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
        onChangeCapture={() => setSaved(false)}
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            const body: Row = { courses: form.courses };
            fields.forEach(([k]) => (body[k] = form[k] || null));
            setSaved(false);
            const updated = await api('/me/profile', 'PATCH', body);
            setForm({ ...updated, courses: updated.courses || [] });
            setSaved(true);
          });
        }}
      >
        <fieldset className="form-fields" disabled={action.busy}>
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
                aria-label={w('课程', 'Course')}
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
                aria-label={w('任课老师', 'Teacher')}
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
                aria-label={w('课程简述', 'Course description')}
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
                  aria-label={w('移除此课程', 'Remove course')}
                  onClick={() =>
                    setForm({
                      ...form,
                      courses: form.courses.filter((_: Row, i: number) => i !== n),
                    })
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
              {saved && (
                <div role="status" className="notice">
                  {w('资料已保存。', 'Profile saved.')}
                </div>
              )}
              <button className="btn" disabled={action.busy}>
                {w('保存资料', 'Save profile')}
              </button>
            </>
          )}
        </fieldset>
      </form>
      <h2 className="mt-8">{w('交易评价', 'Trade reviews')}</h2>
      <ErrorNotice error={reviews.error} />
      {reviews.isPending && <Loading />}
      {reviews.data?.items?.map((r: Row) => (
        <div className="panel" key={r.id}>
          <strong>
            {r.nickname} · {'★'.repeat(r.rating)}
          </strong>
          <p>{r.comment}</p>
        </div>
      ))}
      {!reviews.isPending && !reviews.error && !reviews.data?.items?.length && (
        <Empty text={w('还没有评价', 'No reviews yet')} />
      )}
      <LoadMore query={reviews} />
    </section>
  );
}
export function Messages({ id }: { id?: string }) {
  return (
    <Gate>
      <ChatPanel id={id} />
    </Gate>
  );
}
export function Trades({ id }: { id?: string }) {
  return (
    <Gate>
      <TradeBoard key={id || 'list'} id={id} />
    </Gate>
  );
}
function TradeBoard({ id }: { id?: string }) {
  const w = useWords();
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const list = usePagedApi(
    '/trades?' + new URLSearchParams({ ...(role ? { role } : {}), ...(status ? { status } : {}) }),
    !id,
  );
  const detail = useApi('/trades/' + id, !!id);
  const q = id ? detail : list;
  const me = useMe();
  const action = useAction();
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  return (
    <section className="page narrow">
      <h1>{w('我的交易', 'Your trades')}</h1>
      {!id && (
        <div className="list-filters">
          <Field label={w('交易类型', 'Trade type')}>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">{w('全部交易', 'All trades')}</option>
              <option value="buyer">{w('我买入的', 'Purchases')}</option>
              <option value="seller">{w('我卖出的', 'Sales')}</option>
              <option value="swap">{w('以物换物', 'Swaps')}</option>
            </select>
          </Field>
          <Field label={w('交易状态', 'Trade status')}>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{w('全部状态', 'All statuses')}</option>
              <option value="WAITING_MEETUP">{w('待面交', 'Awaiting meetup')}</option>
              <option value="PARTIALLY_CONFIRMED">
                {w('等待另一方确认', 'Partially confirmed')}
              </option>
              <option value="COMPLETED">{w('已完成', 'Completed')}</option>
              <option value="CANCELLED">{w('已取消', 'Cancelled')}</option>
            </select>
          </Field>
        </div>
      )}
      {q.isPending && <Loading />}
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
          {!q.isPending && !q.error && !q.data?.items?.length && (
            <Empty text={w('当前筛选下没有交易。', 'No trades match these filters.')} />
          )}
          <LoadMore query={list} />
        </div>
      ) : (
        detail.data &&
        (() => {
          const t = detail.data!;
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
                    : t.status === 'CANCELLED'
                      ? w('预约已取消', 'Reservation cancelled')
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
              {t.status === 'CANCELLED' && (
                <p className="notice">
                  {w('取消原因', 'Cancellation reason')}: {t.cancelReason}
                </p>
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
  const mine = usePagedApi('/me/listings?status=AVAILABLE&swapEnabled=true');
  const others = usePagedApi('/listings?swapEnabled=true');
  const [direction, setDirection] = useState('');
  const [requestStatus, setRequestStatus] = useState('');
  const requests = usePagedApi(
    '/swap-requests?' +
      new URLSearchParams({
        ...(direction ? { direction } : {}),
        ...(requestStatus ? { status: requestStatus } : {}),
      }),
  );
  const [offered, setOffered] = useState('');
  const [requested, setRequested] = useState(
    new URLSearchParams(location.search).get('listingId') || '',
  );
  const target = useApi('/listings/' + requested, !!requested);
  const choices = [
    ...new Map(
      [...(others.data?.items || []), ...(target.data ? [target.data] : [])].map((i: Row) => [
        i.id,
        i,
      ]),
    ).values(),
  ];
  const [proposed, setProposed] = useState(false);
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
            setProposed(false);
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
            setProposed(true);
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
              {choices
                .filter((i: Row) => i.ownerId !== me.data?.id)
                .map((i: Row) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        <div className="form-row">
          <div>
            <ErrorNotice error={mine.error} />
            <LoadMore query={mine} />
          </div>
          <div>
            <ErrorNotice error={others.error || target.error} />
            <LoadMore query={others} />
          </div>
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
        {proposed && (
          <div className="notice" role="status">
            {w('换物请求已发出。', 'Swap request sent.')}
          </div>
        )}
      </form>
      <h2 className="mt-8">{w('我的换物请求', 'Your swap requests')}</h2>
      <div className="list-filters">
        <Field label={w('请求方向', 'Request direction')}>
          <select value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="">{w('全部请求', 'All requests')}</option>
            <option value="sent">{w('我发出的', 'Sent')}</option>
            <option value="received">{w('我收到的', 'Received')}</option>
          </select>
        </Field>
        <Field label={w('请求状态', 'Request status')}>
          <select value={requestStatus} onChange={(e) => setRequestStatus(e.target.value)}>
            <option value="">{w('全部状态', 'All statuses')}</option>
            <option value="PENDING">{w('待接受', 'Pending')}</option>
            <option value="ACCEPTED">{w('已接受', 'Accepted')}</option>
            <option value="REJECTED">{w('已拒绝', 'Rejected')}</option>
            <option value="WITHDRAWN">{w('已撤回', 'Withdrawn')}</option>
          </select>
        </Field>
      </div>
      <ErrorNotice error={requests.error} />
      {requests.isPending && <Loading />}
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
        {!requests.isPending && !requests.error && !requests.data?.items?.length && (
          <Empty text={w('没有符合条件的换物请求。', 'No swap requests match these filters.')} />
        )}
        <LoadMore query={requests} />
      </div>
    </section>
  );
}
export function Notifications() {
  const w = useWords();
  const [unread, setUnread] = useState(false);
  const q = usePagedApi('/notifications?unreadOnly=' + unread);
  const action = useAction();
  return (
    <Gate>
      <section className="page narrow">
        <h1>{w('通知', 'Notifications')}</h1>
        <label className="check-row mb-6">
          <input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} />
          {w('仅未读', 'Unread only')}
        </label>
        {q.isPending && <Loading />}
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
          {!q.isPending && !q.error && !q.data?.items?.length && (
            <Empty text={w('暂无通知。', 'No notifications.')} />
          )}
          <LoadMore query={q} />
        </div>
      </section>
    </Gate>
  );
}
export function Admin() {
  return (
    <Gate>
      <AdminPanel />
    </Gate>
  );
}
