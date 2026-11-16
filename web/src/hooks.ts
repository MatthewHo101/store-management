import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, request } from './api.js';
import type { Page, Workspace } from './types.js';

export function useWorkspace() {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const active = useRef<AbortController | null>(null);
  const reload = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError('');
    try {
      const paths = [
        '/health',
        '/suppliers',
        '/customers',
        '/warehouses',
        '/products',
        '/lots',
        '/orders',
        '/purchases',
        '/recipes',
        '/reports/inventory',
        '/reports/operations',
      ];
      const keys = [
        'health',
        'suppliers',
        'customers',
        'warehouses',
        'products',
        'lots',
        'orders',
        'purchases',
        'recipes',
        'inventory',
        'operations',
      ];
      const values = await Promise.all(
        paths.map((path) => request(path, { signal: controller.signal })),
      );
      if (!controller.signal.aborted)
        setData(Object.fromEntries(keys.map((key, i) => [key, values[i]])) as unknown as Workspace);
    } catch (error) {
      if (!controller.signal.aborted) setError(errorMessage(error));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    return () => active.current?.abort();
  }, [reload]);
  return { data, error, loading, reload };
}
const pages: Page[] = ['overview', 'inventory', 'purchasing', 'production', 'orders', 'directory'];
function currentPage(): Page {
  const value = window.location.hash.replace('#/', '') as Page;
  return pages.includes(value) ? value : 'overview';
}
export function usePage() {
  const [page, setPage] = useState(currentPage);
  useEffect(() => {
    const change = () => setPage(currentPage());
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  return [
    page,
    (next: Page) => {
      window.location.hash = `/${next}`;
      setPage(next);
    },
  ] as const;
}
export function useResource<T>(path: string) {
  const [state, setState] = useState<{ data: T | null; error: string }>({ data: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, error: '' });
    void request<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ data: null, error: errorMessage(error) });
      });
    return () => controller.abort();
  }, [path]);
  return state;
}
