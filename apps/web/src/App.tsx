import { useEffect, useState } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  ArrowUpRight,
  Plus,
  Search,
  MessageCircle,
  Sun,
  Moon,
  Globe,
  Leaf,
  Menu,
  ArrowRight,
  BookOpen,
  Headphones,
  Lamp,
  ShoppingBag,
  Bell,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { Client } from '@stomp/stompjs';
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
import { Account, Editor, Profile, Messages, Trades, Swaps, Admin, Notifications } from './pages';
export function App() {
  const prefs = usePreferences();
  const w = useWords();
  const me = useMe();
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menu, setMenu] = useState(false);
  const [page, id] = pathname.split('/').filter(Boolean);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', prefs.dark);
    document.documentElement.lang = prefs.locale;
  }, [prefs.dark, prefs.locale]);
  useEffect(() => {
    if (!me.data) return;
    let active = true;
    let client: Client;
    void refreshCsrf().then((token) => {
      if (!active) return;
      client = new Client({
        brokerURL: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`,
        connectHeaders: { 'X-CSRF-TOKEN': token },
        reconnectDelay: 4000,
        onConnect: () => {
          client.subscribe('/user/queue/events', () => {
            void queryClient.invalidateQueries();
          });
          void queryClient.invalidateQueries();
        },
      });
      client.activate();
    });
    return () => {
      active = false;
      void client?.deactivate();
    };
  }, [me.data?.id]);
  const links = [
    ['/', w('逛校园', 'Explore')],
    ['/zones', w('季节专区', 'Collections')],
    ['/swaps', w('以物换物', 'Swap')],
  ];
  return (
    <div className="app">
      <header className="site-header">
        <Link to="/" className="brand">
          <span className="brand-icon">
            <Leaf size={23} />
          </span>
          <span>
            Campus
            <span className="brand-second">
              {' '}
              Neighbour<span className="brand-dot">.</span>
            </span>
          </span>
        </Link>
        <nav
          id="primary-navigation"
          aria-label={w('主导航', 'Main navigation')}
          className={menu ? 'top-nav open' : 'top-nav'}
        >
          {links.map(([to, label]) => (
            <Link
              key={to}
              to={to}
              className={pathname === to ? 'active' : ''}
              onClick={() => setMenu(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="icon-btn"
            aria-label={w('切换语言', 'Switch language')}
            onClick={() => prefs.setLocale(prefs.locale === 'en' ? 'zh-CN' : 'en')}
          >
            <Globe size={18} />
            <span>{prefs.locale === 'en' ? '中' : 'EN'}</span>
          </button>
          <button
            className="icon-btn"
            aria-label={w('切换主题', 'Switch theme')}
            onClick={prefs.toggleTheme}
          >
            {prefs.dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {me.data ? (
            <>
              <Link
                to="/notifications"
                aria-label={w('通知', 'Notifications')}
                className="icon-btn"
              >
                <Bell size={18} />
              </Link>
              <Link to="/profile" className="avatar" aria-label={w('我的资料', 'My profile')}>
                {me.data.nickname?.slice(0, 1)}
              </Link>
            </>
          ) : (
            <Link to="/login" className="login-link">
              {w('登录', 'Sign in')} <ArrowUpRight size={15} />
            </Link>
          )}
          <Link to={me.data ? '/publish' : '/login'} className="btn compact">
            <Plus size={17} />
            {w('发布闲置', 'List an item')}
          </Link>
          <button
            className="mobile-menu icon-btn"
            aria-label={w('菜单', 'Menu')}
            aria-expanded={menu}
            aria-controls="primary-navigation"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
        </div>
      </header>
      <main>
        {!page ? (
          <Marketplace />
        ) : page === 'listings' && id ? (
          <Listing id={id} />
        ) : page === 'login' ? (
          <Account />
        ) : page === 'publish' ? (
          <Editor />
        ) : page === 'edit' ? (
          <Editor key={id} id={id} />
        ) : page === 'profile' ? (
          <Profile key={id || 'self'} id={id} />
        ) : page === 'mine' ? (
          <MyListings />
        ) : page === 'messages' ? (
          <Messages id={id} />
        ) : page === 'trades' ? (
          <Trades key={id || 'list'} id={id} />
        ) : page === 'swaps' ? (
          <Swaps />
        ) : page === 'admin' ? (
          <Admin />
        ) : page === 'notifications' ? (
          <Notifications />
        ) : page === 'zones' ? (
          <Zones id={id} />
        ) : page === 'payment-unavailable' ? (
          <Payment />
        ) : (
          <Empty />
        )}
      </main>
      <footer>
        <Link to="/" className="brand small">
          <Leaf size={18} /> Campus Neighbour.
        </Link>
        <span>{w('让闲置流动，让校园更近。', 'Good things deserve another chapter.')}</span>
        <div>
          {me.data && (
            <>
              <Link to="/mine">{w('我的商品', 'My listings')}</Link>
              <Link to="/trades">{w('我的交易', 'My trades')}</Link>
              <Link to="/messages">{w('消息', 'Messages')}</Link>
              {me.data.role === 'ADMIN' && <Link to="/admin">{w('管理', 'Admin')}</Link>}
              <button
                onClick={async () => {
                  await api('/auth/logout', 'POST');
                  queryClient.clear();
                  await refreshCsrf();
                  void nav({ to: '/' });
                }}
              >
                <LogOut size={14} />
                {w('退出', 'Sign out')}
              </button>
            </>
          )}
        </div>
      </footer>
      <nav className="bottom-nav" aria-label={w('移动导航', 'Mobile navigation')}>
        <Link to="/" aria-current={!page ? 'page' : undefined}>
          {w('逛一逛', 'Explore')}
        </Link>
        <Link to="/messages" aria-current={page === 'messages' ? 'page' : undefined}>
          {w('消息', 'Messages')}
        </Link>
        <Link
          to={me.data ? '/publish' : '/login'}
          className="mobile-publish"
          aria-label={w('发布闲置', 'List an item')}
        >
          <Plus size={20} />
          <span>{w('发布', 'Sell')}</span>
        </Link>
        <Link to="/trades" aria-current={page === 'trades' ? 'page' : undefined}>
          {w('交易', 'Trades')}
        </Link>
        <Link to="/profile" aria-current={page === 'profile' ? 'page' : undefined}>
          {w('我的', 'Me')}
        </Link>
      </nav>
    </div>
  );
}
export function Card({ item }: { item: Row }) {
  const w = useWords();
  const locale = usePreferences((s) => s.locale);
  return (
    <Link to={`/listings/${item.id}`} className="product-card">
      <div className="product-image">
        {item.coverUrl ? (
          <img src={item.coverUrl} alt={item.title} loading="lazy" />
        ) : (
          <BookOpen size={58} />
        )}
        <span className="image-label">
          {item.swapEnabled ? w('可换物', 'Open to swap') : w('校园面交', 'Campus pickup')}
        </span>
        <span className="card-arrow">
          <ArrowUpRight size={18} />
        </span>
      </div>
      <div className="card-body">
        <div className="flex justify-between gap-2">
          <h3>{item.title}</h3>
          <strong>{money(item.priceMinor)}</strong>
        </div>
        <p>
          {item.building?.[locale === 'en' ? 'nameEn' : 'nameZh']} ·{' '}
          {w('线下面交', 'Meet on campus')}
        </p>
        <div className="card-foot">
          <span>
            <i className="online-dot" />
            {item.seller?.nickname}
          </span>
          <span>
            {w(
              (
                { NEW: '全新', LIKE_NEW: '几乎全新', GOOD: '状态良好', FAIR: '正常使用' } as Record<
                  string,
                  string
                >
              )[item.conditionCode] || '',
              item.conditionCode?.replaceAll('_', ' ').toLowerCase(),
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}
function Marketplace() {
  const w = useWords();
  const locale = usePreferences((s) => s.locale);
  const initial = new URLSearchParams(location.search);
  const [q, setQ] = useState(initial.get('q') || '');
  const [category, setCategory] = useState(initial.get('categoryId') || '');
  const [building, setBuilding] = useState(initial.get('buildingId') || '');
  const [course, setCourse] = useState(initial.get('courseId') || '');
  const [sort, setSort] = useState(initial.get('sort') || 'NEWEST');
  const [min, setMin] = useState(initial.get('min') || '');
  const [max, setMax] = useState(initial.get('max') || '');
  const [cursor, setCursor] = useState('0');
  const categories = useApi('/dictionaries/categories');
  const buildings = useApi('/dictionaries/buildings');
  const courses = useApi('/dictionaries/courses');
  const params = new URLSearchParams({
    q,
    sort,
    cursor,
    ...(category ? { categoryId: category } : {}),
    ...(building ? { buildingId: building } : {}),
    ...(course ? { courseId: course } : {}),
    ...(min ? { minPriceMinor: String(Math.round(Number(min) * 100)) } : {}),
    ...(max ? { maxPriceMinor: String(Math.round(Number(max) * 100)) } : {}),
  });
  const products = useApi('/listings?' + params);
  useEffect(() => {
    const visible = new URLSearchParams({
      q,
      sort,
      ...(category ? { categoryId: category } : {}),
      ...(building ? { buildingId: building } : {}),
      ...(course ? { courseId: course } : {}),
      ...(min ? { min } : {}),
      ...(max ? { max } : {}),
    });
    history.replaceState(history.state, '', '/?' + visible);
  }, [q, sort, category, building, course, min, max]);
  const options = (data: Row | undefined) =>
    data?.items?.map((d: Row) => (
      <option key={d.id} value={d.id}>
        {d[locale === 'en' ? 'nameEn' : 'nameZh']}
      </option>
    ));
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> {w('校园里的好物，值得下一站', 'A little closer. A little greener.')}
          </div>
          <h1>
            {w('你的闲置，', 'Your once-loved.')}
            <br />
            <em>{w('别人的刚需。', 'Their next favourite.')}</em>
          </h1>
          <p>
            {w(
              '从一本教材到一盏台灯，在校园里找到它的下一位主人。',
              'From a well-read textbook to a favourite desk lamp. Find good things, and good neighbours, right on campus.',
            )}
          </p>
          <div className="hero-actions">
            <a className="btn" href="#market">
              {w('发现校园好物', 'Explore the marketplace')}
              <ArrowRight size={18} />
            </a>
            <span>
              <Leaf size={16} />
              {w('重复使用，比全新更有意义', 'Less waste. More possibilities.')}
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-grid" />
          <div className="art-sticker sticker-one">
            <RefreshCw size={17} />
            {w('旧物 · 新故事', 'A new chapter')}
          </div>
          <div className="book book-one">
            <span>
              THE
              <br />
              NEXT
              <br />
              CHAPTER.
            </span>
            <i>Campus Neighbour</i>
          </div>
          <div className="book book-two" />
          <div className="plant">
            <i />
            <i />
            <i />
            <b />
          </div>
          <div className="art-sticker sticker-two">
            <span className="tiny-avatar">C</span>
            {w('在你身边，刚刚好', 'Right around the corner')}
            <ArrowUpRight size={15} />
          </div>
        </div>
      </section>
      <div className="value-strip">
        <span>
          <BookOpen size={18} />
          {w('按课程找教材', 'Books for your course')}
        </span>
        <span>
          <ShoppingBag size={18} />
          {w('同楼交易，下楼就拿', 'Find it in your hall')}
        </span>
        <span>
          <MessageCircle size={18} />
          {w('直接沟通，安心面交', 'Chat first, meet on campus')}
        </span>
      </div>
      <section id="market" className="market">
        <div className="section-heading">
          <div>
            <div className="eyebrow">THE CAMPUS EDIT</div>
            <h2>{w('好物，就在身边', 'Find your next good thing')}</h2>
          </div>
          <span className="muted">{w('给闲置一次新的相遇', 'Pre-loved, ready for you.')}</span>
        </div>
        <div className="search-line">
          <div className="search-box">
            <Search size={20} />
            <input
              aria-label={w('搜索商品', 'Search items')}
              placeholder={w(
                '搜索教材、数码、宿舍好物…',
                'Search books, tech, and everyday essentials…',
              )}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setCursor('0');
              }}
            />
          </div>
          <select
            aria-label={w('排序', 'Sort')}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setCursor('0');
            }}
          >
            <option value="NEWEST">{w('最新发布', 'Newest first')}</option>
            <option value="PRICE_ASC">{w('价格从低到高', 'Price: low to high')}</option>
            <option value="PRICE_DESC">{w('价格从高到低', 'Price: high to low')}</option>
          </select>
        </div>
        <div className="filter-line">
          <div className="categories">
            <button
              className={!category ? 'chip selected' : 'chip'}
              onClick={() => {
                setCategory('');
                setCursor('0');
              }}
            >
              {w('全部好物', 'All finds')}
            </button>
            {categories.data?.items?.map((d: Row) => (
              <button
                key={d.id}
                className={category === d.id ? 'chip selected' : 'chip'}
                onClick={() => {
                  setCategory(d.id);
                  setCursor('0');
                }}
              >
                {d[locale === 'en' ? 'nameEn' : 'nameZh']}
              </button>
            ))}
          </div>
          <div className="secondary-filters">
            <select
              aria-label={w('楼栋', 'Building')}
              value={building}
              onChange={(e) => {
                setBuilding(e.target.value);
                setCursor('0');
              }}
            >
              <option value="">{w('全部楼栋', 'All halls')}</option>
              {options(buildings.data)}
            </select>
            <select
              aria-label={w('课程', 'Course')}
              value={course}
              onChange={(e) => {
                setCourse(e.target.value);
                setCursor('0');
              }}
            >
              <option value="">{w('全部课程', 'All courses')}</option>
              {options(courses.data)}
            </select>
            <input
              className="price-input"
              aria-label={w('最低价格', 'Minimum price')}
              placeholder="¥ min"
              type="number"
              min="0"
              value={min}
              onChange={(e) => {
                setMin(e.target.value);
                setCursor('0');
              }}
            />
            <input
              className="price-input"
              aria-label={w('最高价格', 'Maximum price')}
              placeholder="¥ max"
              type="number"
              min="0"
              value={max}
              onChange={(e) => {
                setMax(e.target.value);
                setCursor('0');
              }}
            />
          </div>
        </div>
        <ErrorNotice error={products.error} />
        {products.isPending ? (
          <Loading />
        ) : products.data?.items?.length ? (
          <div className="product-grid">
            {products.data.items.map((i: Row) => (
              <Card item={i} key={i.id} />
            ))}
          </div>
        ) : (
          <Empty />
        )}
        <div className="pagination">
          {cursor !== '0' && (
            <button className="chip" onClick={() => setCursor('0')}>
              {w('回到第一页', 'First page')}
            </button>
          )}
          {products.data?.nextCursor && (
            <button className="chip" onClick={() => setCursor(products.data!.nextCursor)}>
              {w('下一页', 'Next page')}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </section>
    </>
  );
}
function Listing({ id }: { id: string }) {
  const item = useApi('/listings/' + id);
  const me = useMe();
  const w = useWords();
  const locale = usePreferences((s) => s.locale);
  const nav = useNavigate();
  const action = useAction();
  const [picture, setPicture] = useState(0);
  if (item.isPending) return <Loading />;
  if (!item.data) return <ErrorNotice error={item.error} />;
  const l = item.data;
  return (
    <section className="page">
      <Link to="/" className="back">
        ← {w('返回市场', 'Back to marketplace')}
      </Link>
      <div className="detail-grid">
        <div>
          <div className="detail-image">
            {l.images?.length ? (
              <img src={l.images[picture]?.url} alt={l.title} />
            ) : (
              <BookOpen size={90} />
            )}
          </div>
          <div className="thumbs">
            {l.images?.map((i: Row, n: number) => (
              <button key={i.id} onClick={() => setPicture(n)}>
                <img src={i.url} alt={`${n + 1}`} />
              </button>
            ))}
          </div>
        </div>
        <div className="detail-copy">
          <Status value={l.status} />
          <h1>{l.title}</h1>
          <div className="price">{money(l.priceMinor)}</div>
          <p className="pre-line">{l.description}</p>
          <div className="details-table">
            <p>
              <span>{w('地点', 'Location')}</span>
              {l.building?.[locale === 'en' ? 'nameEn' : 'nameZh']}
            </p>
            <p>
              <span>{w('课程 / 版本', 'Course / edition')}</span>
              {l.course?.[locale === 'en' ? 'nameEn' : 'nameZh'] || '—'} / {l.bookEdition || '—'}
            </p>
            {l.bookAuthor && (
              <p>
                <span>{w('作者', 'Author')}</span>
                {l.bookAuthor}
              </p>
            )}
            <p>
              <span>{w('成色', 'Condition')}</span>
              {w(
                (
                  {
                    NEW: '全新',
                    LIKE_NEW: '几乎全新',
                    GOOD: '状态良好',
                    FAIR: '正常使用',
                  } as Record<string, string>
                )[l.conditionCode] || '',
                l.conditionCode?.replaceAll('_', ' ').toLowerCase(),
              )}
            </p>
            {l.wantedDescription && (
              <p>
                <span>{w('希望换得', 'Looking to swap for')}</span>
                {l.wantedDescription}
              </p>
            )}
          </div>
          <Link to={`/profile/${l.ownerId}`} className="seller">
            <span className="avatar">{l.seller.nickname?.slice(0, 1)}</span>
            <div>
              <strong>{l.seller.nickname}</strong>
              <small>{l.seller.college || w('校园邻居', 'Your campus neighbour')}</small>
            </div>
            <ArrowUpRight size={20} />
          </Link>
          <ErrorNotice error={action.error} />
          {me.data?.id === l.ownerId ? (
            <Link className="btn" to={`/edit/${l.id}`}>
              {w('编辑商品', 'Edit listing')}
            </Link>
          ) : (
            <>
              <button
                className="btn wide"
                disabled={action.busy || l.status !== 'AVAILABLE'}
                onClick={() =>
                  void action.run(async () => {
                    if (!me.data) {
                      void nav({ to: '/login' });
                      return;
                    }
                    const c = await api('/conversations', 'POST', { listingId: id });
                    void nav({ to: `/messages/${c.id}` });
                  })
                }
              >
                <MessageCircle size={18} />
                {w('联系卖家', 'Chat with seller')}
              </button>
              {l.swapEnabled && (
                <Link to="/swaps" search={{ listingId: id }} className="btn secondary wide">
                  {w('发起以物换物', 'Propose a swap')}
                  <RefreshCw size={17} />
                </Link>
              )}
            </>
          )}
          <p className="micro">
            {w(
              '线下面交。请核实物品后再确认收货。',
              'Meet on campus. Inspect the item before confirming receipt.',
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
function MyListings() {
  const [status, setStatus] = useState('');
  const q = usePagedApi('/me/listings' + (status ? '?status=' + status : ''));
  const w = useWords();
  return (
    <section className="page">
      <h1>{w('我的商品', 'My listings')}</h1>
      <div className="list-filters">
        <label className="field">
          <span>{w('商品状态', 'Listing status')}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{w('全部状态', 'All statuses')}</option>
            <option value="AVAILABLE">{w('可交易', 'Available')}</option>
            <option value="RESERVED">{w('已预约', 'Reserved')}</option>
            <option value="SOLD">{w('已售出', 'Sold')}</option>
            <option value="EXCHANGED">{w('已交换', 'Exchanged')}</option>
            <option value="WITHDRAWN">{w('已下架', 'Withdrawn')}</option>
          </select>
        </label>
      </div>
      <ErrorNotice error={q.error} />
      {q.isPending ? (
        <Loading />
      ) : q.data?.items?.length ? (
        <div className="product-grid">
          {q.data.items.map((i: Row) => (
            <div key={i.id}>
              <Status value={i.status} />
              <Card item={i} />
            </div>
          ))}
        </div>
      ) : !q.error ? (
        <Empty text={w('当前筛选下没有商品。', 'No listings match these filters.')} />
      ) : null}
      <LoadMore query={q} />
    </section>
  );
}
function Zones({ id }: { id?: string }) {
  const w = useWords();
  const locale = usePreferences((s) => s.locale);
  const q = usePagedApi(id ? `/zones/${id}/listings` : '/zones');
  return (
    <section className="page">
      <div className="eyebrow">SEASONAL COLLECTIONS</div>
      <h1>{w('每个季节，都有新的开始', 'A fresh start, every season.')}</h1>
      <ErrorNotice error={q.error} />
      {q.isPending ? (
        <Loading />
      ) : id ? (
        <div className="product-grid">
          {q.data?.items?.map((i: Row) => (
            <Card item={i} key={i.id} />
          ))}
        </div>
      ) : (
        <div className="zone-grid">
          {q.data?.items?.map((z: Row) => (
            <Link to={`/zones/${z.id}`} key={z.id} className="zone-card">
              <Leaf />
              <h2>{z[locale === 'en' ? 'titleEn' : 'titleZh']}</h2>
              <p>{z[locale === 'en' ? 'descriptionEn' : 'descriptionZh']}</p>
              <span>
                {new Date(z.endsAt).toLocaleDateString()} <ArrowUpRight size={18} />
              </span>
            </Link>
          ))}
        </div>
      )}
      {!q.isPending && !q.error && !q.data?.items?.length && <Empty />}
      <LoadMore query={q} />
    </section>
  );
}
export function Payment() {
  const w = useWords();
  return (
    <section className="page payment">
      <div className="payment-icon">
        <ShoppingBag size={36} />
      </div>
      <h1>{w('暂时无法提供支付方式', 'Payment methods are currently unavailable')}</h1>
      <p>
        {w(
          '这是支付入口展示页。平台不处理真实资金，交易状态不会改变。',
          'This is a payment preview. No money is processed and your trade status is unchanged.',
        )}
      </p>
      <Link to="/trades" className="btn">
        {w('返回我的交易', 'Back to my trades')}
        <ArrowRight size={18} />
      </Link>
    </section>
  );
}
