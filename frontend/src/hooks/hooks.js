import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Loads data with loading/error state. `fetcher` is re-run whenever `deps` change or `reload()` is called.
export function useFetch(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null, errorStatus: null });
  const latest = useRef(0);
  const run = useCallback(() => {
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null, errorStatus: null }));
    Promise.resolve(fetcher())
      .then((data) => id === latest.current && setState({ data, loading: false, error: null, errorStatus: null }))
      .catch((error) => id === latest.current && setState((s) => ({ ...s, loading: false, error: error.message, errorStatus: error.status || null })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(run, [run]);
  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload: run, setData };
}

// Categories and locations change rarely, so share one request across the whole session.
let catalogPromise;
export function useCatalog() {
  const [catalog, setCatalog] = useState({ categories: [], locations: [] });
  useEffect(() => {
    catalogPromise ||= api.get('/catalog').catch((e) => { catalogPromise = null; throw e; });
    catalogPromise.then(setCatalog).catch(() => {});
  }, []);
  return catalog;
}
export const resetCatalog = () => { catalogPromise = null; };

// Branding from Admin > Settings (name, institution, contact). Shared across the session and refreshed after an admin saves.
const DEFAULT_SETTINGS = { appName: 'Campus Lost & Found', institutionName: '', contactEmail: '', supportContact: '' };
let settingsPromise;
export const refreshAppSettings = () => { settingsPromise = null; window.dispatchEvent(new Event('clf:settings')); };
export function useAppSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  useEffect(() => {
    const load = () => {
      settingsPromise ||= api.get('/public/settings').catch(() => DEFAULT_SETTINGS);
      settingsPromise.then(setSettings);
    };
    load();
    window.addEventListener('clf:settings', load);
    return () => window.removeEventListener('clf:settings', load);
  }, []);
  return settings;
}

// Animates a number from 0 to `target` (skipped when the user prefers reduced motion).
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target == null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !target) return setValue(target || 0);
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
