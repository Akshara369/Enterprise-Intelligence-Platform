import React, { createContext, useContext, useState, useEffect } from 'react';

const defaultAuthContext = {
  user: null,
  accessToken: null,
  login: async () => false,
  logout: async () => {},
  refresh: async () => false,
  authFetch: async (input, init = {}) => fetch(input, init)
};

const AuthContext = createContext(defaultAuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('eintel_access_token'));
  const [ready, setReady] = useState(false);

  const login = async (username, password) => {
    const normalizedUser = (username || '').trim();
    const normalizedPassword = password || '';

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalizedUser, password: normalizedPassword })
      });

      if (!res.ok) return false;
      const data = await res.json();
      const resolvedUser = data.user || { username: normalizedUser };
      if (!data.accessToken) return false;
      localStorage.setItem('eintel_access_token', data.accessToken);
      setAccessToken(data.accessToken);
      setUser(resolvedUser);
      localStorage.setItem('eintel_username', resolvedUser.username || normalizedUser);
      localStorage.setItem('eintel_is_logged_in', 'true');
      return true;
    } catch (error) {
      return false;
    }
  };

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST', headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
    localStorage.removeItem('eintel_access_token');
    setUser(null);
    setAccessToken(null);
  };

  const refresh = async () => {
    const token = accessToken || localStorage.getItem('eintel_access_token');
    const res = await fetch('/api/refresh', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('eintel_access_token');
      return false;
    }
    const data = await res.json();
    localStorage.setItem('eintel_access_token', data.accessToken);
    setAccessToken(data.accessToken);
    setUser(data.user);
    return true;
  };

  // Try to refresh on mount so sessions persist across reloads (if refresh cookie exists)
  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (e) {
        // ignore
      } finally {
        setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wrapper that attaches Authorization header and retries once on 401 using refresh
  const authFetch = async (input, init = {}) => {
    init.headers = init.headers || {};
    if (accessToken) init.headers['Authorization'] = `Bearer ${accessToken}`;
    let resp = await fetch(input, init);
    if (resp.status === 401) {
      const ok = await refresh();
      if (ok) {
        const refreshedToken = localStorage.getItem('eintel_access_token');
        if (refreshedToken) init.headers['Authorization'] = `Bearer ${refreshedToken}`;
        resp = await fetch(input, init);
      }
    }
    return resp;
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, ready, login, logout, refresh, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export default AuthProvider;
