import { useState } from 'react';
import { QueryClient, useQuery } from '@tanstack/react-query';
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
  if (!r.ok) throw new Error(result.error?.code || `HTTP_${r.status}`);
  return result.data as T;
}
export function useApi(path: string, enabled = true) {
  return useQuery({ queryKey: [path], queryFn: () => api(path), enabled });
}
export function useMe() {
  return useApi('/me');
}
export function useAction() {
  const [error, setError] = useState('');
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
        setError(e instanceof Error ? e.message : 'ERROR');
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
    ACCOUNT_RESTRICTED: ['账号受限，无法发起新操作。', 'This account is restricted.'],
    STATE_CONFLICT: ['状态已变化，请刷新后重试。', 'The state changed. Refresh and try again.'],
    VERSION_CONFLICT: ['商品资料已更新，请重新查看。', 'The listing was updated. Please reload.'],
    ITEM_UNAVAILABLE: ['商品已不可交易。', 'This item is no longer available.'],
    MESSAGE_TOO_LONG: ['自由消息不能超过20个字。', 'Free messages are limited to 20 characters.'],
    NOT_FOUND: ['内容不存在或你无权查看。', 'This content is unavailable.'],
    INVALID_IMAGE: ['请上传有效的PNG或JPEG图片。', 'Upload a valid PNG or JPEG image.'],
  };
  return (
    <div role="alert" className="notice error">
      {messages[code]
        ? w(...messages[code])
        : w('操作暂时失败，请稍后重试。', 'Something went wrong. Please try again.')}{' '}
      <small>{code}</small>
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
