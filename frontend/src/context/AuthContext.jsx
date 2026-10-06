import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../services/api';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Staff and admins open their own dashboard (the staff dashboard or the admin dashboard); students open theirs.
export const homeFor = (user) => (['staff', 'admin'].includes(user?.role) ? '/admin' : '/dashboard');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());
  // The page a person deliberately logged out from. The redirect to /login that follows must not become
  // "return here after login" for whoever signs in next (an expired session, by contrast, should return).
  const [loggedOutFrom, setLoggedOutFrom] = useState(null);

  // Set when the saved session could not be checked because the API is unreachable. The session is kept, with a retry.
  const [bootError, setBootError] = useState('');

  const restore = useCallback(() => {
    if (!tokenStore.get()) return;
    setBootError('');
    setLoading(true);
    api.get('/auth/me').then(setUser)
      .catch((e) => { if (e.status && e.status < 500) tokenStore.clear(); else setBootError(e.message); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { restore(); }, [restore]);

  const logout = useCallback((from) => {
    tokenStore.clear();
    setUser(null);
    setLoggedOutFrom(typeof from === 'string' ? from : null);
  }, []);

  // any 401 from the API means the session is no longer valid
  const toast = useToast();
  useEffect(() => {
    const expired = () => { logout(); toast.info('Your session has expired. Please log in again.'); };
    window.addEventListener('clf:unauthorized', expired);
    return () => window.removeEventListener('clf:unauthorized', expired);
  }, [logout, toast]);

  const login = useCallback(async (email, password, remember) => {
    const data = await api.post('/auth/login', { email, password, remember });
    tokenStore.set(data.token, remember);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (values) => {
    const data = await api.post('/auth/register', values);
    tokenStore.set(data.token, false);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(() => ({ user, loading, bootError, retry: restore, loggedOutFrom, login, register, logout, setUser }), [user, loading, bootError, restore, loggedOutFrom, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
