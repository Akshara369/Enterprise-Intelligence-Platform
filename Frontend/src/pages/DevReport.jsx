import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Bot, Boxes, CheckCircle2, CircleAlert, Database, KeyRound, RefreshCw, Server, ShieldCheck, TestTube2, XCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';

const formatTime = value => value ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value)) : 'Not checked';
const isHealthy = status => status === 'Healthy' || status === 'READY';

function StatusBadge({ status, label }) {
  const healthy = isHealthy(status);
  const warning = status === 'Degraded' || status === 'READY WITH WARNINGS';
  return <span className={`badge ${healthy ? 'badge-success' : warning ? 'badge-tech' : 'badge-danger'}`}>
    {healthy ? <CheckCircle2 size={12} /> : <XCircle size={12} />}{label || status}
  </span>;
}

export default function DevReport() {
  const { authFetch, user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshReport = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await authFetch('/api/developer-report');
      if (response.status === 401 || response.status === 403) throw new Error('Administrator access is required to view diagnostics.');
      if (!response.ok) throw new Error(`Developer report request failed (HTTP ${response.status}).`);
      setReport(await response.json());
    } catch (requestError) {
      setError(requestError.message || 'Unable to load backend diagnostics.');
    } finally { setLoading(false); }
  }, [authFetch]);

  useEffect(() => { refreshReport(); }, [refreshReport]);
  const quality = report?.dataQuality;
  const assistant = report?.assistant;
  const storage = report?.storage;

  return <div className="dev-report">
    <div className="dev-report-header"><div>
      <div className="eyebrow"><Activity size={14} /> Operational diagnostics</div><h3>Developer Report</h3>
      <p>Live health, data quality, assistant configuration, and delivery readiness for this sandbox.</p>
    </div><button className="btn btn-secondary" onClick={refreshReport} disabled={loading}><RefreshCw size={15} className={loading ? 'spin-icon' : ''} /> Refresh report</button></div>
    {error && <div className="dev-report-alert"><CircleAlert size={17} /> {error}</div>}

    <div className="kpi-grid" style={{ marginBottom: 0 }}>
      <div className="glass-card kpi-card"><span className="kpi-label">API health</span><div className="kpi-value">{report?.apiHealth?.status || 'Checking'}</div><StatusBadge status={report?.apiHealth?.status} label={`${report?.apiHealth?.reachable ?? 0}/${report?.apiHealth?.total ?? 5} services reachable`} /></div>
      <div className="glass-card kpi-card"><span className="kpi-label">Assistant mode</span><div className="kpi-value report-value-small">{assistant?.mode?.replaceAll('_', ' ') || 'Checking'}</div><StatusBadge status="Healthy" label="Active" /></div>
      <div className="glass-card kpi-card"><span className="kpi-label">Data quality</span><div className="kpi-value">{quality?.status === 'healthy' ? 'Clean' : quality ? 'Review' : 'Checking'}</div><StatusBadge status={quality?.status === 'healthy' ? 'Healthy' : 'Degraded'} label={`${quality?.transactionRows ?? 0} transactions checked`} /></div>
      <div className="glass-card kpi-card"><span className="kpi-label">Storage mode</span><div className="kpi-value report-value-small">{storage?.mode || 'Checking'}</div><StatusBadge status={storage?.status === 'Connected' ? 'Healthy' : 'Down'} label={storage?.status || 'Checking'} /></div>
    </div>

    <div className="dev-report-grid">
      <section className="glass-card"><div className="report-section-title"><Server size={18} /><h4>System architecture</h4></div><div className="architecture-flow"><div><strong>React + Vite</strong><span>Dashboard, analytics, assistant UI</span></div><span className="architecture-arrow">→</span><div><strong>Express API</strong><span>Business logic and orchestration</span></div><span className="architecture-arrow">→</span><div><strong>{storage?.mode || 'Storage'}</strong><span>{storage?.status || 'Checking connection'}</span></div></div><div className="report-details"><span><Database size={14} /> {storage?.mode || 'Checking storage'}</span><span><Boxes size={14} /> Backtesting + DataMart + Assistant</span><span><ShieldCheck size={14} /> Admin-only; no secrets displayed</span></div></section>
      <section className="glass-card"><div className="report-section-title"><Bot size={18} /><h4>Assistant & model configuration</h4></div><dl className="report-definition-list"><div><dt>Runtime mode</dt><dd>{assistant?.mode?.replaceAll('_', ' ') || 'Checking'}</dd></div><div><dt>Model</dt><dd>{!assistant?.model || assistant.model === 'Not configured' ? 'Local Tool Engine' : assistant.model}</dd></div><div><dt>Guardrail limit</dt><dd>{assistant?.guardrailLimit || 'Checking'}</dd></div><div><dt>Active sessions</dt><dd>{assistant?.activeSessions ?? 0}</dd></div><div><dt>API key</dt><dd>{assistant?.apiKeyConfigured ? 'Configured' : 'Local Mode'}</dd></div></dl><p className="report-muted">The report only shows key presence; no secret value is returned.</p></section>
      <section className="glass-card"><div className="report-section-title"><Activity size={18} /><h4>API service checks</h4></div><div className="service-list">{(report?.services || []).map(service => <div className="service-row" key={service.name}><span>{service.name}<small>{service.path} · {service.detail}</small></span><StatusBadge status={service.status} label={`${service.httpStatus} · ${service.latencyMs}ms`} /></div>)}{!loading && !report?.services?.length && <span className="report-muted">No service results returned.</span>}</div><div className="report-section-title" style={{ marginTop: 18 }}><Boxes size={18} /><h4>Module diagnostics</h4></div><div className="service-list">{(report?.modules || []).filter(module => module.name !== 'RAG').map(module => <div className="service-row" key={module.name}><span>{module.name}<small>{module.detail}</small></span><StatusBadge status={module.status} /></div>)}</div></section>
      <section className="glass-card"><div className="report-section-title"><Database size={18} /><h4>Data quality snapshot</h4></div><div className="quality-grid"><span><strong>{quality?.catalogProducts ?? 0}</strong> catalog products</span><span><strong>{quality?.transactionRows ?? 0}</strong> transactions</span><span><strong>{quality?.stockHistoryRows ?? 0}</strong> market rows</span><span><strong>{quality?.lowStockProducts ?? 0}</strong> low-stock products</span></div><div className="quality-result"><StatusBadge status={quality?.status === 'healthy' ? 'Healthy' : 'Degraded'} label={`${quality?.invalidTransactionRows ?? 0} invalid transactions · ${quality?.invalidStockRows ?? 0} invalid market rows · ${quality?.duplicateRecords ?? 0} duplicates`} /></div></section>
      <section className="glass-card"><div className="report-section-title"><TestTube2 size={18} /><h4>Validation & tests</h4></div><div className="test-callout"><ShieldCheck size={20} className="trend-up" /><div><strong>Live data validation enabled</strong><span>Records, duplicate identifiers, module dependencies, and storage are checked on every refresh.</span></div></div><p className="report-muted">Each backend probe runs concurrently with a bounded timeout.</p></section>
      <section className="glass-card"><div className="report-section-title"><KeyRound size={18} /><h4>Delivery readiness</h4></div><div className="quality-result"><StatusBadge status={report?.deliveryReadiness?.status} label={report?.deliveryReadiness?.status || 'Checking'} /></div><dl className="report-definition-list" style={{ marginTop: 16 }}><div><dt>Authentication</dt><dd>{report?.configuration?.authentication || 'Checking'}</dd></div><div><dt>Persistence</dt><dd>{report?.configuration?.persistence || 'Checking'}</dd></div><div><dt>API versioning</dt><dd>{report?.configuration?.apiVersion || 'Checking'}</dd></div></dl><p className="report-muted">{report?.deliveryReadiness?.reason || 'Running readiness checks.'}</p></section>
    </div><div className="report-footer">Signed in as: {user?.name || user?.username || 'Unknown'} · Last refreshed: {formatTime(report?.generatedAt)}</div>
  </div>;
}
