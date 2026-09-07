import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, ErrorKind } from '../lib/api.js';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Kimliği doğrulanmış tek bir API kaynağı için okuma kancası.
 *
 * Ayırt edilen durumlar (hepsi UI'da bilinçli olarak ele alınır):
 *   loading    → ilk yükleme, henüz veri yok
 *   refreshing → veri var, arka planda yenileniyor
 *   error      → istek başarısız
 *   forbidden  → 403, RBAC engeli (hata değil, ayrı bir durum)
 *   success    → veri hazır
 *
 * @param {(token: string, signal: AbortSignal) => Promise<{data: any, status: number}>} fetcher
 * @param {object} [options]
 * @param {boolean} [options.enabled]        istek yapılsın mı
 * @param {number} [options.refreshInterval] otomatik yenileme (ms), 0 = kapalı
 * @param {any[]} [options.deps]             fetcher'ı yeniden bağlayan bağımlılıklar
 */
export function useApiResource(fetcher, options = {}) {
  const { enabled = true, refreshInterval = 0, deps = [] } = options;
  const { token } = useAuth();

  const [state, setState] = useState({
    data: null,
    status: 'idle', // idle | loading | refreshing | success | error | forbidden
    error: null,
    httpStatus: null,
    lastUpdatedAt: null,
  });

  const abortRef = useRef(null);
  const mountedRef = useRef(true);
  // fetcher her render'da yeni bir kapanış olabilir; ref ile sabitleriz.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const run = useCallback(
    async ({ background = false } = {}) => {
      if (!enabled || !token) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((prev) => ({
        ...prev,
        status: background && prev.data !== null ? 'refreshing' : 'loading',
        error: background ? prev.error : null,
      }));

      try {
        const { data, status } = await fetcherRef.current(token, controller.signal);
        if (!mountedRef.current || controller.signal.aborted) return;

        setState({
          data,
          status: 'success',
          error: null,
          httpStatus: status,
          lastUpdatedAt: Date.now(),
        });
      } catch (err) {
        if (!mountedRef.current || controller.signal.aborted) return;
        if (err instanceof ApiError && err.kind === ErrorKind.ABORTED) return;

        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError({ kind: ErrorKind.UNKNOWN, message: 'Veri alınamadı.' });

        setState((prev) => ({
          ...prev,
          status: apiError.kind === ErrorKind.FORBIDDEN ? 'forbidden' : 'error',
          error: apiError,
          httpStatus: apiError.status,
        }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, token, ...deps]
  );

  // İlk yükleme ve bağımlılık değişiminde yeniden getirme.
  useEffect(() => {
    if (!enabled || !token) {
      setState({ data: null, status: 'idle', error: null, httpStatus: null, lastUpdatedAt: null });
      return;
    }
    run();
  }, [run, enabled, token]);

  // Periyodik arka plan yenilemesi — sekme gizliyken çalışmaz.
  useEffect(() => {
    if (!refreshInterval || !enabled || !token) return undefined;

    const id = setInterval(() => {
      if (document.visibilityState === 'visible') run({ background: true });
    }, refreshInterval);

    return () => clearInterval(id);
  }, [refreshInterval, enabled, token, run]);

  const refresh = useCallback(() => run({ background: true }), [run]);
  const retry = useCallback(() => run({ background: false }), [run]);

  return {
    data: state.data,
    error: state.error,
    httpStatus: state.httpStatus,
    lastUpdatedAt: state.lastUpdatedAt,
    status: state.status,
    isLoading: state.status === 'loading',
    isRefreshing: state.status === 'refreshing',
    isForbidden: state.status === 'forbidden',
    isError: state.status === 'error',
    isSuccess: state.status === 'success',
    refresh,
    retry,
  };
}
