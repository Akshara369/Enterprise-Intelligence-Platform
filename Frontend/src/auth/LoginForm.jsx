import React, { useState } from 'react';
import { useAuth } from './AuthProvider.jsx';

export default function LoginForm({ onSuccess }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e && e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const ok = await login(username.trim(), password);
      if (!ok) setError('Invalid username or password');
      else onSuccess && onSuccess();
    } catch (err) {
      setError('Network or server error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="login-form" aria-label="Sign in form">
      <div className="form-row">
        <label className="form-label">Username</label>
        <input
          className="input-cyber"
          placeholder="username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
        />
      </div>

      <div className="form-row">
        <label className="form-label">Password</label>
        <div className="password-row">
          <input
            className="input-cyber"
            type={showPwd ? 'text' : 'password'}
            placeholder="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button type="button" className="pwd-toggle" onClick={() => setShowPwd(s => !s)} aria-label={showPwd ? 'Hide password' : 'Show password'}>
            {showPwd ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Signing...' : 'Sign in'}</button>
      </div>
    </form>
  );
}
