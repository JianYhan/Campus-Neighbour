import { useState } from 'react';
import { QueryClient, useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
// Boundary type for the documented JSON API; domain-specific values are validated by the server.
export type Row = Record<string, any>;
i18n.use(initReactI18next).init({
  lng: localStorage.getItem('campus-language') || 'zh-CN',
  fallbackLng: 'zh-CN',
  resources: {
    'zh-CN': { translation: { brand: '校园邻里' } },
    en: { translation: { brand: 'Campus Neighbour' } },
  },
  interpolation: { escapeValue: false },
});
export { i18n };
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true } },
});
export const usePreferences = create(
  persist<{
    locale: string;
    dark: boolean;
    setLocale: (locale: string) => void;
    toggleTheme: () => void;
  }>(
    (set) => ({
      locale: localStorage.getItem('campus-language') || 'zh-CN',
      dark: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
      setLocale: (locale) => {
        localStorage.setItem('campus-language', locale);
        void i18n.changeLanguage(locale);
        set({ locale });
      },
      toggleTheme: () => set((s) => ({ dark: !s.dark })),
    }),
    { name: 'campus-preferences' },
  ),
);
export function useWords() {
  const en = usePreferences((s) => s.locale) === 'en';
  return (zh: string, enText: string) => (en ? enText : zh);
}
let csrf = '';
export class ApiError extends Error {
  constructor(
    public code: string,
    public fieldErrors: Record<string, string> = {},
    public requestId?: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}
export async function refreshCsrf() {
  const r = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' });
  if (!r.ok) throw new Error('DEPENDENCY_UNAVAILABLE');
  csrf = (await r.json()).data.token;
  return csrf;
}
export async function api<T = Row>(
  path: string,
  method = 'GET',
  body?: unknown,
  key?: string,
): Promise<T> {
  if (method !== 'GET' && !csrf) await refreshCsrf();
  const multipart = body instanceof FormData;
  const r = await fetch('/api/v1' + path, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(multipart ? {} : { 'Content-Type': 'application/json' }),
      ...(method === 'GET'
        ? {}
        : { 'X-CSRF-TOKEN': csrf, 'Idempotency-Key': key || crypto.randomUUID() }),
    },
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
  });
  if (r.status === 204) return {} as T;
  const result = await r.json();
  if (!r.ok)
    throw new ApiError(
      result.error?.code || `HTTP_${r.status}`,
      result.error?.fieldErrors || {},
      result.error?.requestId,
    );
  return result.data as T;
}
export function useApi(path: string, enabled = true) {
  return useQuery({ queryKey: [path], queryFn: () => api(path), enabled });
}
export function usePagedApi(path: string, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: ['paged', path],
    enabled,
    initialPageParam: '',
    queryFn: ({ pageParam }) => {
      const [endpoint, search] = path.split('?');
      const params = new URLSearchParams(search);
      if (!params.has('limit')) params.set('limit', '20');
      if (pageParam) params.set('cursor', pageParam);
      return api(endpoint + '?' + params);
    },
    getNextPageParam: (last) => last.nextCursor || undefined,
  });
  const data = query.data
    ? {
        items: [
          ...new Map<string, Row>(
            query.data.pages.flatMap((p) =>
              (p.items || []).map((item: Row) => [item.id, item] as [string, Row]),
            ),
          ).values(),
        ],
        nextCursor: query.data.pages.at(-1)?.nextCursor ?? null,
      }
    : undefined;
  return { ...query, data };
}
export function LoadMore({ query }: { query: ReturnType<typeof usePagedApi> }) {
  const w = useWords();
  if (!query.hasNextPage && !query.isFetchNextPageError) return null;
  return (
    <div className="pagination">
      {query.isFetchNextPageError && <ErrorNotice error={query.error} />}
      <button
        type="button"
        className="chip"
        disabled={query.isFetchingNextPage}
        onClick={() => void query.fetchNextPage()}
      >
        {query.isFetchingNextPage
          ? w('正在加载…', 'Loading…')
          : query.isFetchNextPageError
            ? w('重试加载更多', 'Retry loading more')
            : w('加载更多', 'Load more')}
      </button>
    </div>
  );
}
export function useMe() {
  return useApi('/me');
}
export function useAction() {
  const [error, setError] = useState<unknown>('');
  const [busy, setBusy] = useState(false);
  return {
    error,
    busy,
    run: async (fn: () => Promise<unknown>) => {
      setBusy(true);
      setError('');
      try {
        await fn();
        await queryClient.invalidateQueries();
      } catch (e) {
        setError(e instanceof Error ? e : new Error('ERROR'));
      } finally {
        setBusy(false);
      }
    },
  };
}
export const money = (n: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(n / 100);
export function ErrorNotice({ error }: { error: unknown }) {
  const w = useWords();
  if (!error) return null;
  const code = error instanceof Error ? error.message : String(error);
  const messages: Record<string, [string, string]> = {
    UNAUTHENTICATED: ['请先登录。', 'Please sign in.'],
    INVALID_CREDENTIALS: ['邮箱或密码不正确。', 'Email or password is incorrect.'],
    VALIDATION_ERROR: ['请检查填写内容和长度。', 'Check the values and field lengths.'],
    FORBIDDEN: [
      '你没有执行此操作的权限，请重新登录后重试。',
      'This action is not allowed. Sign in again if your session expired.',
    ],
    ACCOUNT_RESTRICTED: [
      '相关账号已受限，无法进行此操作。',
      'A participant account is restricted.',
    ],
    STATE_CONFLICT: ['状态已变化，请刷新后重试。', 'The state changed. Refresh and try again.'],
    VERSION_CONFLICT: ['商品资料已更新，请重新查看。', 'The listing was updated. Please reload.'],
    ITEM_UNAVAILABLE: ['商品已不可交易。', 'This item is no longer available.'],
    MESSAGE_TOO_LONG: ['自由消息不能超过20个字。', 'Free messages are limited to 20 characters.'],
    NOT_FOUND: ['内容不存在或你无权查看。', 'This content is unavailable.'],
    INVALID_IMAGE: ['请上传有效的PNG或JPEG图片。', 'Upload a valid PNG or JPEG image.'],
    IDEMPOTENCY_CONFLICT: [
      '这次操作的内容已变化，请刷新后重新操作。',
      'This request has changed. Refresh before trying again.',
    ],
    DEPENDENCY_UNAVAILABLE: [
      '服务暂时不可用，请稍后重试。',
      'The service is temporarily unavailable. Please retry.',
    ],
  };
  const labels: Record<string, [string, string]> = {
    title: ['商品名称', 'Title'],
    description: ['商品描述', 'Description'],
    priceMinor: ['价格', 'Price'],
    categoryId: ['分类', 'Category'],
    buildingId: ['楼栋', 'Building'],
    courseId: ['课程', 'Course'],
    conditionCode: ['成色', 'Condition'],
    imageIds: ['商品图片', 'Photos'],
    bookAuthor: ['作者', 'Author'],
    bookEdition: ['教材版本', 'Edition'],
    wantedDescription: ['希望换得的物品', 'Wanted item'],
    email: ['邮箱', 'Email'],
    password: ['密码', 'Password'],
    nickname: ['昵称', 'Nickname'],
    college: ['学院', 'College'],
    major: ['专业', 'Major'],
    year: ['年级', 'Year'],
    bio: ['简介', 'About you'],
    courses: ['课程背景', 'Course background'],
    teacher: ['任课老师', 'Teacher'],
    meetingAt: ['面交时间', 'Meeting time'],
    meetingLocation: ['面交地点', 'Meeting location'],
    offeredListingId: ['我提供的物品', 'Offered item'],
    requestedListingId: ['目标物品', 'Requested item'],
    reason: ['处理原因', 'Reason'],
    rating: ['评分', 'Rating'],
    comment: ['评价内容', 'Review'],
    titleZh: ['中文名称', 'Chinese name'],
    titleEn: ['英文名称', 'English name'],
    nameZh: ['中文名称', 'Chinese name'],
    nameEn: ['英文名称', 'English name'],
    descriptionZh: ['中文说明', 'Chinese description'],
    descriptionEn: ['英文说明', 'English description'],
    startsAt: ['开始时间', 'Start time'],
    endsAt: ['结束时间', 'End time'],
    minPriceMinor: ['最低价格', 'Minimum price'],
    maxPriceMinor: ['最高价格', 'Maximum price'],
  };
  const reasons: Record<string, [string, string]> = {
    REQUIRED: ['请填写此项。', 'This field is required.'],
    TOO_LONG: ['内容超过长度限制。', 'This value is too long.'],
    TOO_SHORT: ['内容未达到最短长度。', 'This value is too short.'],
    INVALID_FORMAT: ['格式不正确。', 'Use the expected format.'],
    OUT_OF_RANGE: ['请填写允许范围内的值。', 'Use a value within the allowed range.'],
    MUST_BE_FUTURE: ['请选择未来的时间。', 'Choose a future time.'],
    INVALID_REFERENCE: [
      '该选项已不可用，请重新选择。',
      'This option is unavailable. Choose another.',
    ],
    INVALID_CHOICE: ['请选择有效选项。', 'Choose a valid option.'],
  };
  const fields = error instanceof ApiError ? Object.entries(error.fieldErrors) : [];
  return (
    <div role="alert" className="notice error">
      {messages[code]
        ? w(...messages[code])
        : w('操作暂时失败，请稍后重试。', 'Something went wrong. Please try again.')}{' '}
      {fields.length > 0 && (
        <ul className="mt-2 list-disc pl-5">
          {fields.map(([field, reason]) => (
            <li key={field}>
              {labels[field] ? w(...labels[field]) : w('填写内容', 'Field')}:{' '}
              {reasons[reason] ? w(...reasons[reason]) : w('请检查此项内容。', 'Check this field.')}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
export function Status({ value }: { value: string }) {
  const w = useWords();
  const zh: Record<string, string> = {
    AVAILABLE: '可交易',
    RESERVED: '已预约',
    SOLD: '已售出',
    EXCHANGED: '已交换',
    WITHDRAWN: '已下架',
    WAITING_MEETUP: '待面交',
    PARTIALLY_CONFIRMED: '等待另一方确认',
    COMPLETED: '已完成',
    CANCELLED: '已取消',
    PENDING: '待接受',
    ACCEPTED: '已接受',
    REJECTED: '已拒绝',
    INVALIDATED: '已失效',
    HIDDEN: '已隐藏',
    VISIBLE: '可见',
    ACTIVE: '正常',
    RESTRICTED: '受限',
  };
  return (
    <span className="badge">
      {w(zh[value] || value, value?.replaceAll('_', ' ').toLowerCase())}
    </span>
  );
}
export function Loading() {
  const w = useWords();
  return (
    <div className="skeleton" role="status">
      {w('正在加载…', 'Loading…')}
    </div>
  );
}
export function Empty({ text }: { text?: string }) {
  const w = useWords();
  return (
    <div className="empty">
      <span>↗</span>
      <h3>{text || w('这里还没有内容', 'Nothing here yet')}</h3>
      <p>{w('发布一件闲置，或试着调整筛选条件。', 'List an item or try different filters.')}</p>
    </div>
  );
}
