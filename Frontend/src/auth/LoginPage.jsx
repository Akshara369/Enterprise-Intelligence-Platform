import React from 'react';
import LoginForm from './LoginForm.jsx';

export default function LoginPage({ onLogin }) {
  return (
    <div className="login-hero-outer">
      <div className="login-hero-container">
        <div className="hero-left">
          <div className="logo-stack">
            <div className="logo-badge-large">E</div>
            <div>
              <div className="brand-title">E-Intel Platform</div>
              <div className="brand-sub">Enterprise Intelligence • Retail + Trading</div>
            </div>
          </div>
          <h1 className="hero-heading">Enterprise Intelligence, Built for Action</h1>

          <p className="hero-sub">Analytics, KPIs, backtesting and operational intelligence to power retail and trading workflows.</p>

          <ul className="feature-list">
            <li className="feature-item">Real-time DataMart KPIs</li>
            <li className="feature-item">Backtesting & Market Experiments</li>
            <li className="feature-item">AI-assisted Operational Intelligence</li>
          </ul>
        </div>

        <div className="hero-right">
          <div className="sign-card">
            <div className="sign-card-header">
              <h3>Sign in</h3>
              <div className="sign-card-sub">Access your E-Intel dashboard</div>
            </div>

            <LoginForm onSuccess={onLogin} />

            <div className="credentials-line muted">Demo account · <strong>admin</strong> / <strong>admin</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}
