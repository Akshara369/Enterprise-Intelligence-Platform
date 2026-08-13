import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, Bot, Boxes, CheckCircle2, CircleAlert, Database,
  KeyRound, RefreshCw, Server, ShieldCheck, TestTube2, XCircle
} from 'lucide-react';

const monitoredEndpoints = [
  { name: 'Catalog service', path: '/api/catalog' },
  { name: 'Transaction ledger', path: '/api/transactions' },
  { name: 'Market data', path: '/api/stocks' },
  { name: 'KPI service', path: '/api/kpis' },
  { name: 'Assistant health', path: '/api/assistant/health' }
];

const formatTime = (value) => value
  ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value))
  : 'Not yet checked';

function StatusBadge({ healthy, label }) {
  return (
    <span className={`badge ${healthy ? 'badge-success' : 'badge-danger'}`}>
      {healthy ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {label}
    </span>
  );
}

export default function DevReport() {
  const [diagnostics, setDiagnostics] = useState(null);
  const [endpointStatus, setEndpointStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshReport = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [diagnosticResult, ...endpointResults] = await Promise.all([
        fetch('/api/diagnostics'),
        ...monitoredEndpoints.map(async (endpoint) => {
          const startedAt = performance.now();
          try {
            const response = await fetch(endpoint.path);
            return {
              ...endpoint,
              healthy: response.ok,
              status: response.status,
              latency: Math.round(performance.now() - startedAt)
            };
          } catch {
            return { ...endpoint, healthy: false, status: 'Offline', latency: null };
          }
        })
      ]);

      if (!diagnosticResult.ok) throw new Error('Diagnostics endpoint returned an error.');
      setDiagnostics(await diagnosticResult.json());
      setEndpointStatus(endpointResults);
    } catch (requestError) {
      setError(requestError.message || 'Unable to connect to the backend diagnostics service.');
      setEndpointStatus([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshReport();
  }, [refreshReport]);

  const quality = diagnostics?.dataQuality;
  const assistant = diagnostics?.assistant;
  const allEndpointsHealthy = endpointStatus.length === monitoredEndpoints.length && endpointStatus.every(endpoint => endpoint.healthy);

  return (
    <div className="dev-report">
      <div className="dev-report-header">
        <div>
          <div className="eyebrow"><Activity size={14} /> Operational diagnostics</div>
          <h3>Developer Report</h3>
          <p>Live health, data quality, assistant configuration, and delivery readiness for this sandbox.</p>
        </div>
        <button className="btn btn-secondary" onClick={refreshReport} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin-icon' : ''} /> Refresh report
        </button>
      </div>

      {error && <div className="dev-report-alert"><CircleAlert size={17} /> {error}</div>}

      <div className="kpi-grid" style={{ marginBottom: 0 }}>
        <div className="glass-card kpi-card">
          <span className="kpi-label">API health</span>
          <div className="kpi-value">{loading ? '…' : allEndpointsHealthy ? 'Healthy' : 'Check'}</div>
          <StatusBadge healthy={allEndpointsHealthy} label={`${endpointStatus.filter(item => item.healthy).length}/${monitoredEndpoints.length} services reachable`} />
        </div>
        <div className="glass-card kpi-card">
          <span className="kpi-label">Assistant mode</span>
          <div className="kpi-value report-value-small">{assistant?.llmEnabled ? 'LLM enabled' : 'Rule engine'}</div>
          <span className="report-muted">{assistant?.model || 'Checking configuration…'}</span>
        </div>
        <div className="glass-card kpi-card">
          <span className="kpi-label">Data quality</span>
          <div className="kpi-value">{quality?.status === 'healthy' ? 'Clean' : quality ? 'Review' : '…'}</div>
          <StatusBadge healthy={quality?.status === 'healthy'} label={`${quality?.transactionRows ?? 0} transactions checked`} />
        </div>
        <div className="glass-card kpi-card">
          <span className="kpi-label">Storage mode</span>
          <div className="kpi-value report-value-small">Sandbox</div>
          <span className="report-muted">In-memory; resets on restart</span>
        </div>
      </div>

      <div className="dev-report-grid">
        <section className="glass-card">
          <div className="report-section-title"><Server size={18} /><h4>System architecture</h4></div>
          <div className="architecture-flow">
            <div><strong>React + Vite</strong><span>Dashboard, analytics, assistant UI</span></div>
            <span className="architecture-arrow">→</span>
            <div><strong>Express API</strong><span>Business logic and orchestration</span></div>
            <span className="architecture-arrow">→</span>
            <div><strong>Sandbox state</strong><span>Catalog, orders, prices, sessions</span></div>
          </div>
          <div className="report-details">
            <span><Database size={14} /> {diagnostics?.service?.storage || 'Loading…'}</span>
            <span><Boxes size={14} /> Backtesting + DataMart + Assistant</span>
            <span><ShieldCheck size={14} /> CORS enabled; no secrets displayed</span>
          </div>
        </section>

        <section className="glass-card">
          <div className="report-section-title"><Bot size={18} /><h4>Assistant & model configuration</h4></div>
          <dl className="report-definition-list">
            <div><dt>Runtime mode</dt><dd>{assistant?.mode?.replaceAll('_', ' ') || 'Loading…'}</dd></div>
            <div><dt>Model</dt><dd>{assistant?.model || 'Loading…'}</dd></div>
            <div><dt>Guardrail limit</dt><dd>{assistant?.rateLimit || 'Loading…'}</dd></div>
            <div><dt>Active sessions</dt><dd>{assistant?.activeSessions ?? '…'}</dd></div>
          </dl>
          <p className="report-muted">API-key presence is reported, but the key itself is never exposed.</p>
        </section>

        <section className="glass-card">
          <div className="report-section-title"><Activity size={18} /><h4>API service checks</h4></div>
          <div className="service-list">
            {endpointStatus.map(endpoint => (
              <div className="service-row" key={endpoint.path}>
                <span>{endpoint.name}<small>{endpoint.path}</small></span>
                <StatusBadge healthy={endpoint.healthy} label={`${endpoint.status}${endpoint.latency !== null ? ` · ${endpoint.latency}ms` : ''}`} />
              </div>
            ))}
            {!loading && endpointStatus.length === 0 && <span className="report-muted">No endpoint results available.</span>}
          </div>
        </section>

        <section className="glass-card">
          <div className="report-section-title"><Database size={18} /><h4>Data quality snapshot</h4></div>
          <div className="quality-grid">
            <span><strong>{quality?.catalogProducts ?? '…'}</strong> catalog products</span>
            <span><strong>{quality?.transactionRows ?? '…'}</strong> transactions</span>
            <span><strong>{quality?.stockHistoryRows ?? '…'}</strong> market rows</span>
            <span><strong>{quality?.lowStockProducts ?? '…'}</strong> low-stock products</span>
          </div>
          <div className="quality-result">
            <StatusBadge healthy={(quality?.invalidTransactionRows || 0) === 0 && (quality?.invalidStockRows || 0) === 0} label={`${quality?.invalidTransactionRows ?? 0} invalid transactions · ${quality?.invalidStockRows ?? 0} invalid market rows`} />
          </div>
        </section>

        <section className="glass-card">
          <div className="report-section-title"><TestTube2 size={18} /><h4>Validation & tests</h4></div>
          <div className="test-callout"><ShieldCheck size={20} className="trend-up" /><div><strong>Look-ahead bias validator available</strong><span>Run <code>{diagnostics?.tests?.command || 'npm run test:lookahead'}</code> from the Backend folder.</span></div></div>
          <p className="report-muted">{diagnostics?.tests?.coverage || 'Loading test information…'}</p>
        </section>

        <section className="glass-card">
          <div className="report-section-title"><KeyRound size={18} /><h4>Delivery readiness</h4></div>
          <dl className="report-definition-list">
            <div><dt>Authentication</dt><dd>{diagnostics?.configuration?.authentication || 'Loading…'}</dd></div>
            <div><dt>Persistence</dt><dd>{diagnostics?.configuration?.persistence || 'Loading…'}</dd></div>
            <div><dt>API versioning</dt><dd>{diagnostics?.configuration?.apiVersion || 'Loading…'}</dd></div>
          </dl>
          <p className="report-muted">Production hardening priorities: authentication, persistent storage, automated test coverage, and observability.</p>
        </section>
      </div>

      <div className="report-footer">Last refreshed: {formatTime(diagnostics?.generatedAt)}</div>
    </div>
  );
}
