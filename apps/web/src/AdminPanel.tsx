import { useState, type FormEvent, type ReactNode } from 'react';
import {
  api,
  useApi,
  useMe,
  useWords,
  usePreferences,
  useAction,
  usePagedApi,
  ErrorNotice,
  Status,
  Loading,
  Empty,
  LoadMore,
  type Row,
} from './lib';

type Tab = 'listings' | 'users' | 'dictionaries' | 'zones' | 'audit-logs';
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function localDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function collectionBody(row: Row, enabled = row.enabled) {
  return {
    titleZh: row.titleZh,
    titleEn: row.titleEn,
    descriptionZh: row.descriptionZh || null,
    descriptionEn: row.descriptionEn || null,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    enabled,
    categoryId: row.categoryId || null,
    buildingId: row.buildingId || null,
  };
}

export function AdminPanel() {
  const w = useWords();
  const me = useMe();
  const [tab, setTab] = useState<Tab>('listings');
  const [kind, setKind] = useState('buildings');
  if (me.isPending) return <Loading />;
  if (me.error) return <ErrorNotice error={me.error} />;
  if (me.data?.role !== 'ADMIN') return <ErrorNotice error="FORBIDDEN" />;
  const tabs: Array<[Tab, string]> = [
    ['listings', w('商品', 'Listings')],
    ['users', w('账号', 'Accounts')],
    ['dictionaries', w('校园字典', 'Campus dictionaries')],
    ['zones', w('季节专区', 'Collections')],
    ['audit-logs', w('处理记录', 'Audit log')],
  ];
  return (
    <section className="page">
      <h1>{w('校园管理', 'Campus administration')}</h1>
      <div className="categories mb-6" aria-label={w('管理模块', 'Administration sections')}>
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? 'chip selected' : 'chip'}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'dictionaries' && (
        <div className="mb-6">
          <Field label={w('字典类型', 'Dictionary type')}>
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="buildings">{w('楼栋', 'Buildings')}</option>
              <option value="courses">{w('课程', 'Courses')}</option>
              <option value="categories">{w('分类', 'Categories')}</option>
            </select>
          </Field>
        </div>
      )}
      <AdminSection key={`${tab}-${kind}`} tab={tab} kind={kind} />
    </section>
  );
}

function AdminSection({ tab, kind }: { tab: Tab; kind: string }) {
  const w = useWords();
  const en = usePreferences((s) => s.locale) === 'en';
  const path = tab === 'dictionaries' ? `/admin/dictionaries/${kind}` : `/admin/${tab}`;
  const [filters, setFilters] = useState<Record<string, string>>({});
  const queryString = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  ).toString();
  const q = usePagedApi(path + (queryString ? '?' + queryString : ''));
  const categories = useApi('/dictionaries/categories', tab === 'zones');
  const buildings = useApi('/dictionaries/buildings', tab === 'zones');
  const action = useAction();
  const [editing, setEditing] = useState<Row | null>(null);
  const [moderating, setModerating] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const [saved, setSaved] = useState(false);
  const name = (row: Row) =>
    row.title ||
    row.nickname ||
    (en ? row.nameEn || row.titleEn : row.nameZh || row.titleZh) ||
    (row.targetType === 'user'
      ? row.action === 'true'
        ? w('限制账号', 'Account restricted')
        : w('恢复账号', 'Account restored')
      : row.action === 'HIDE'
        ? w('隐藏商品', 'Listing hidden')
        : row.action === 'RESTORE'
          ? w('恢复商品展示', 'Listing visibility restored')
          : row.action);
  async function mutate(request: () => Promise<unknown>) {
    setSaved(false);
    await action.run(async () => {
      await request();
      setSaved(true);
      setEditing(null);
      setModerating(null);
      setReason('');
    });
  }
  function submitModeration(event: FormEvent) {
    event.preventDefault();
    if (!moderating || !reason.trim()) return;
    void mutate(() =>
      api(
        tab === 'users'
          ? `/admin/users/${moderating.id}/restriction`
          : `/admin/listings/${moderating.id}/moderation`,
        'POST',
        tab === 'users'
          ? { restricted: moderating.status !== 'RESTRICTED', reason: reason.trim() }
          : {
              action: moderating.moderationStatus === 'HIDDEN' ? 'RESTORE' : 'HIDE',
              reason: reason.trim(),
            },
      ),
    );
  }
  return (
    <>
      {(tab === 'listings' || tab === 'users' || tab === 'audit-logs') && (
        <AdminFilters
          tab={tab}
          onApply={(value) => {
            setFilters(value);
            setSaved(false);
          }}
        />
      )}
      <ErrorNotice error={action.error} />
      {saved && (
        <p className="notice" role="status">
          {w('已保存。', 'Saved.')}
        </p>
      )}
      {(tab === 'zones' || tab === 'dictionaries') && (
        <>
          {!editing && (
            <button
              className="btn mb-6"
              type="button"
              onClick={() => {
                setEditing({});
                setSaved(false);
              }}
            >
              {tab === 'zones'
                ? w('新增专区', 'Create collection')
                : w('新增字典项', 'Create entry')}
            </button>
          )}
          {editing && (
            <AdminEditor
              key={editing.id || 'new'}
              row={editing}
              zone={tab === 'zones'}
              categories={categories.data?.items || []}
              buildings={buildings.data?.items || []}
              choicesLoading={tab === 'zones' && (categories.isPending || buildings.isPending)}
              choicesError={categories.error || buildings.error}
              retryChoices={() => {
                void categories.refetch();
                void buildings.refetch();
              }}
              busy={action.busy}
              onCancel={() => setEditing(null)}
              onSave={(body) =>
                void mutate(() =>
                  api(
                    editing.id ? `${path}/${editing.id}` : path,
                    editing.id ? 'PATCH' : 'POST',
                    body,
                  ),
                )
              }
            />
          )}
        </>
      )}
      {q.isPending && <Loading />}
      <ErrorNotice error={q.error} />
      {q.isError && !q.data && (
        <button className="chip" type="button" onClick={() => void q.refetch()}>
          {w('重新加载', 'Try again')}
        </button>
      )}
      {!q.isPending && !q.isError && !q.data?.items.length && (
        <Empty text={w('没有符合条件的记录', 'No matching records')} />
      )}
      <div className="stack">
        {q.data?.items.map((row: Row) => (
          <article className="panel" key={row.id}>
            <div className="admin-row">
              <div className="min-w-0">
                <strong className="break-words">{name(row)}</strong>
                <p className="muted break-words">
                  {row.reason ||
                    (en ? row.nameZh || row.titleZh : row.nameEn || row.titleEn) ||
                    row.id}
                </p>
                {tab === 'zones' && (
                  <>
                    <p>{en ? row.descriptionEn : row.descriptionZh}</p>
                    <p className="muted">
                      {new Date(row.startsAt).toLocaleString(en ? 'en-GB' : 'zh-CN')} —{' '}
                      {new Date(row.endsAt).toLocaleString(en ? 'en-GB' : 'zh-CN')}
                    </p>
                    <p className="muted">
                      {w('纳入条件：', 'Eligibility: ')}
                      {row.categoryId
                        ? name(
                            categories.data?.items.find((c: Row) => c.id === row.categoryId) || {},
                          ) || row.categoryId
                        : w('全部分类', 'All categories')}
                      {' · '}
                      {row.buildingId
                        ? name(
                            buildings.data?.items.find((b: Row) => b.id === row.buildingId) || {},
                          ) || row.buildingId
                        : w('全部楼栋', 'All buildings')}
                    </p>
                  </>
                )}
                {tab === 'audit-logs' && (
                  <p className="muted break-words">
                    {w('对象', 'Target')}: {row.targetType} / {row.targetId}
                    <br />
                    {w('处理人', 'Actor')}: {row.actorId}
                    <br />
                    {new Date(row.createdAt).toLocaleString(en ? 'en-GB' : 'zh-CN')}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {row.status && <Status value={row.status} />}
                {tab === 'listings' && <Status value={row.moderationStatus} />}
                {(tab === 'zones' || tab === 'dictionaries') && (
                  <span className="badge">
                    {(tab === 'zones' ? row.enabled : row.active)
                      ? w('已启用', 'Enabled')
                      : w('已停用', 'Disabled')}
                  </span>
                )}
                {(tab === 'listings' || (tab === 'users' && row.role !== 'ADMIN')) && (
                  <button
                    className="chip"
                    type="button"
                    disabled={action.busy}
                    onClick={() => {
                      setModerating(row);
                      setReason('');
                      setSaved(false);
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
                {tab === 'users' && row.role === 'ADMIN' && (
                  <span className="badge">{w('管理员', 'Administrator')}</span>
                )}
                {(tab === 'zones' || tab === 'dictionaries') && (
                  <>
                    <button
                      className="chip"
                      type="button"
                      disabled={action.busy || Boolean(editing)}
                      aria-label={w(`编辑 ${name(row)}`, `Edit ${name(row)}`)}
                      onClick={() => {
                        setEditing(row);
                        setSaved(false);
                      }}
                    >
                      {w('编辑', 'Edit')}
                    </button>
                    <button
                      className="chip"
                      type="button"
                      disabled={action.busy || Boolean(editing)}
                      onClick={() =>
                        void mutate(() =>
                          api(
                            `${path}/${row.id}`,
                            'PATCH',
                            tab === 'zones'
                              ? collectionBody(row, !row.enabled)
                              : { nameZh: row.nameZh, nameEn: row.nameEn, active: !row.active },
                          ),
                        )
                      }
                    >
                      {(tab === 'zones' ? row.enabled : row.active)
                        ? w('停用', 'Disable')
                        : w('启用', 'Enable')}
                    </button>
                  </>
                )}
              </div>
            </div>
            {moderating?.id === row.id && (
              <form className="form-grid mt-4" onSubmit={submitModeration}>
                <Field label={w('处理理由', 'Reason for this action')}>
                  <textarea
                    required
                    maxLength={300}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </Field>
                <div className="flex gap-2">
                  <button className="btn" disabled={action.busy || !reason.trim()}>
                    {w('确认处理', 'Confirm action')}
                  </button>
                  <button
                    className="chip"
                    type="button"
                    disabled={action.busy || Boolean(editing)}
                    onClick={() => setModerating(null)}
                  >
                    {w('取消', 'Cancel')}
                  </button>
                </div>
              </form>
            )}
          </article>
        ))}
      </div>
      <LoadMore query={q} />
    </>
  );
}

function AdminFilters({
  tab,
  onApply,
}: {
  tab: Tab;
  onApply: (filters: Record<string, string>) => void;
}) {
  const w = useWords();
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [moderation, setModeration] = useState('');
  const statusLabels: Record<string, [string, string]> = {
    AVAILABLE: ['可交易', 'Available'],
    RESERVED: ['已预约', 'Reserved'],
    SOLD: ['已售出', 'Sold'],
    EXCHANGED: ['已交换', 'Exchanged'],
    WITHDRAWN: ['已下架', 'Withdrawn'],
    ACTIVE: ['正常', 'Active'],
    RESTRICTED: ['受限', 'Restricted'],
    listing: ['商品', 'Listing'],
    user: ['账号', 'Account'],
  };
  const values =
    tab === 'listings'
      ? ['AVAILABLE', 'RESERVED', 'SOLD', 'EXCHANGED', 'WITHDRAWN']
      : tab === 'users'
        ? ['ACTIVE', 'RESTRICTED']
        : ['listing', 'user'];
  return (
    <form
      className="panel form-grid mb-6"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(
          tab === 'audit-logs'
            ? { targetId: text.trim(), targetType: status }
            : {
                q: text.trim(),
                status,
                ...(tab === 'listings' ? { moderationStatus: moderation } : {}),
              },
        );
      }}
    >
      <div className="form-row">
        <Field label={tab === 'audit-logs' ? w('对象编号', 'Target ID') : w('搜索', 'Search')}>
          <input
            maxLength={100}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              tab === 'listings'
                ? w('商品标题或描述', 'Listing title or description')
                : tab === 'users'
                  ? w('昵称', 'Nickname')
                  : undefined
            }
          />
        </Field>
        <Field label={tab === 'audit-logs' ? w('对象类型', 'Target type') : w('状态', 'Status')}>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{w('全部', 'All')}</option>
            {values.map((value) => (
              <option value={value} key={value}>
                {w(...statusLabels[value])}
              </option>
            ))}
          </select>
        </Field>
        {tab === 'listings' && (
          <Field label={w('展示状态', 'Visibility')}>
            <select value={moderation} onChange={(event) => setModeration(event.target.value)}>
              <option value="">{w('全部', 'All')}</option>
              <option value="VISIBLE">{w('可见', 'Visible')}</option>
              <option value="HIDDEN">{w('已隐藏', 'Hidden')}</option>
            </select>
          </Field>
        )}
      </div>
      <div className="flex gap-2">
        <button className="btn">{w('应用筛选', 'Apply filters')}</button>
        <button
          className="chip"
          type="button"
          onClick={() => {
            setText('');
            setStatus('');
            setModeration('');
            onApply({});
          }}
        >
          {w('重置', 'Reset')}
        </button>
      </div>
    </form>
  );
}

function AdminEditor({
  row,
  zone,
  categories,
  buildings,
  choicesLoading,
  choicesError,
  retryChoices,
  busy,
  onCancel,
  onSave,
}: {
  row: Row;
  zone: boolean;
  categories: Row[];
  buildings: Row[];
  choicesLoading: boolean;
  choicesError: unknown;
  retryChoices: () => void;
  busy: boolean;
  onCancel: () => void;
  onSave: (body: Row) => void;
}) {
  const w = useWords();
  const en = usePreferences((s) => s.locale) === 'en';
  const [zh, setZh] = useState(row.nameZh || row.titleZh || '');
  const [english, setEnglish] = useState(row.nameEn || row.titleEn || '');
  const [descriptionZh, setDescriptionZh] = useState(row.descriptionZh || '');
  const [descriptionEn, setDescriptionEn] = useState(row.descriptionEn || '');
  const [start, setStart] = useState(localDate(row.startsAt));
  const [end, setEnd] = useState(localDate(row.endsAt));
  const [category, setCategory] = useState(row.categoryId || '');
  const [building, setBuilding] = useState(row.buildingId || '');
  const [enabled, setEnabled] = useState((zone ? row.enabled : row.active) !== false);
  const [validation, setValidation] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    setValidation('');
    if (!zh.trim() || !english.trim()) {
      setValidation(w('请填写中英文名称。', 'Enter both Chinese and English names.'));
      return;
    }
    if (zone) {
      if (
        !Number.isFinite(Date.parse(start)) ||
        !Number.isFinite(Date.parse(end)) ||
        Date.parse(end) <= Date.parse(start)
      ) {
        setValidation(w('结束时间必须晚于开始时间。', 'End time must be after start time.'));
        return;
      }
      onSave({
        titleZh: zh.trim(),
        titleEn: english.trim(),
        descriptionZh: descriptionZh.trim() || null,
        descriptionEn: descriptionEn.trim() || null,
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
        categoryId: category || null,
        buildingId: building || null,
        enabled,
      });
    } else onSave({ nameZh: zh.trim(), nameEn: english.trim(), active: enabled });
  }
  function options(rows: Row[], current: string) {
    return (
      <>
        <option value="">{w('不限制', 'Any')}</option>
        {current && !rows.some((item) => item.id === current) && (
          <option value={current}>
            {w('当前已停用或无法加载的条件', 'Current unavailable condition')} ({current})
          </option>
        )}
        {rows.map((item) => (
          <option value={item.id} key={item.id}>
            {en ? item.nameEn : item.nameZh}
          </option>
        ))}
      </>
    );
  }
  return (
    <form className="panel form-grid mb-6" onSubmit={submit}>
      <h2>
        {row.id
          ? w('编辑内容', 'Edit details')
          : zone
            ? w('新增专区', 'Create collection')
            : w('新增字典项', 'Create entry')}
      </h2>
      {validation && (
        <p className="notice error" role="alert">
          {validation}
        </p>
      )}
      <div className="form-row">
        <Field label={w('中文名称', 'Chinese name')}>
          <input
            required
            maxLength={100}
            value={zh}
            onChange={(event) => setZh(event.target.value)}
          />
        </Field>
        <Field label={w('英文名称', 'English name')}>
          <input
            required
            maxLength={100}
            value={english}
            onChange={(event) => setEnglish(event.target.value)}
          />
        </Field>
      </div>
      {zone && (
        <>
          <div className="form-row">
            <Field label={w('中文说明', 'Chinese description')}>
              <textarea
                maxLength={1000}
                value={descriptionZh}
                onChange={(event) => setDescriptionZh(event.target.value)}
              />
            </Field>
            <Field label={w('英文说明', 'English description')}>
              <textarea
                maxLength={1000}
                value={descriptionEn}
                onChange={(event) => setDescriptionEn(event.target.value)}
              />
            </Field>
          </div>
          <div className="form-row">
            <Field label={w('开始', 'Starts')}>
              <input
                required
                type="datetime-local"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </Field>
            <Field label={w('结束', 'Ends')}>
              <input
                required
                type="datetime-local"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </Field>
          </div>
          <p className="muted">
            {w(
              '时间使用当前设备时区。专区仅在启用且处于时间范围内时展示，分类和楼栋同时作为纳入条件。',
              'Times use your device timezone. Collections appear only while enabled and within this period. Listings must match both selected conditions.',
            )}
          </p>
          {choicesLoading && <Loading />}
          <ErrorNotice error={choicesError} />
          {Boolean(choicesError) && (
            <button className="chip" type="button" onClick={retryChoices}>
              {w('重新加载条件', 'Reload conditions')}
            </button>
          )}
          <div className="form-row">
            <Field label={w('纳入分类', 'Include category')}>
              <select
                disabled={choicesLoading}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {options(categories, category)}
              </select>
            </Field>
            <Field label={w('纳入楼栋', 'Include building')}>
              <select
                disabled={choicesLoading}
                value={building}
                onChange={(event) => setBuilding(event.target.value)}
              >
                {options(buildings, building)}
              </select>
            </Field>
          </div>
        </>
      )}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        {w('启用', 'Enabled')}
      </label>
      <div className="flex gap-2">
        <button className="btn" disabled={busy || choicesLoading}>
          {busy
            ? w('正在保存…', 'Saving…')
            : row.id
              ? w('保存修改', 'Save changes')
              : w('新增', 'Create')}
        </button>
        <button className="chip" type="button" disabled={busy} onClick={onCancel}>
          {w('取消', 'Cancel')}
        </button>
      </div>
    </form>
  );
}
