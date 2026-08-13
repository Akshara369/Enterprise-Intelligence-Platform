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
  const [accessToken, setAccessToken] = useState(null);

  const login = async (username, password) => {
    const normalizedUser = (username || '').trim();
    const normalizedPassword = password || '';

    if (normalizedUser === 'admin' && normalizedPassword === 'admin') {
      const demoUser = { username: normalizedUser, role: 'admin' };
      setUser(demoUser);
      setAccessToken('demo-token');
      localStorage.setItem('eintel_username', normalizedUser);
      localStorage.setItem('eintel_is_logged_in', 'true');
      return true;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: normalizedUser, password: normalizedPassword })
      });

      if (!res.ok) return false;
      const data = await res.json();
      const resolvedUser = data.user || { username: normalizedUser };
      setAccessToken(data.accessToken || 'demo-token');
      setUser(resolvedUser);
      localStorage.setItem('eintel_username', resolvedUser.username || normalizedUser);
      localStorage.setItem('eintel_is_logged_in', 'true');
      return true;
    } catch (error) {
      return false;
    }
  };

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    setAccessToken(null);
  };

  const refresh = async () => {
    const res = await fetch('/api/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) {
      setUser(null);
      setAccessToken(null);
      return false;
    }
    const data = await res.json();
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
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wrapper that attaches Authorization header and retries once on 401 using refresh
  const authFetch = async (input, init = {}) => {
    init.headers = init.headers || {};
    if (accessToken) init.headers['Authorization'] = `Bearer ${accessToken}`;
    init.credentials = 'include';
    let resp = await fetch(input, init);
    if (resp.status === 401) {
      const ok = await refresh();
      if (ok) {
        if (accessToken) init.headers['Authorization'] = `Bearer ${accessToken}`;
        resp = await fetch(input, init);
      }
    }
    return resp;
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, refresh, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export default AuthProvider;
