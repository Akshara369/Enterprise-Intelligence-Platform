import React, { useState, useEffect } from 'react';
import { Play, TrendingUp, Info, DollarSign, Award, Percent } from 'lucide-react';
import LookAheadValidator from '../components/LookAheadValidator.jsx';

export default function Backtesting({ stocks = [] }) {
  const [strategyName, setStrategyName] = useState('transactionMomentum');
  const [ticker, setTicker] = useState('TECH');
  const [initialCapital, setInitialCapital] = useState(10000);
  
  const [backtestResult, setBacktestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Auto-run default backtest when stocks load
  useEffect(() => {
    if (stocks.length > 0 && !backtestResult) {
      triggerBacktest();
    }
  }, [stocks]);

  const triggerBacktest = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategyName, ticker, initialCapital: Number(initialCapital) })
      });
      
      if (response.ok) {
        const data = await response.json();
        setBacktestResult(data);
      } else {
        const err = await response.json();
        setError(err.error || 'Backtest execution failed');
      }
    } catch (e) {
      console.error(e);
      setError('Connection to backend backtesting engine lost.');
    } finally {
      setLoading(false);
    }
  };

  // Custom Dual-Line SVG Chart Plotting Equity Curve vs Stock Price
  const renderDualChart = () => {
    if (!backtestResult || !backtestResult.history || backtestResult.history.length === 0) return null;

    const history = backtestResult.history;
    const height = 240;
    const width = 600;
    const padding = { top: 20, right: 60, bottom: 30, left: 60 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Equity Min / Max
    const equityValues = history.map(h => h.equity);
    const maxEquity = Math.max(...equityValues) * 1.05;
    const minEquity = Math.min(...equityValues, backtestResult.initialCapital) * 0.95;
    const rangeEquity = maxEquity - minEquity;

    // Price Min / Max
    const priceValues = history.map(h => h.price);
    const maxPrice = Math.max(...priceValues) * 1.05;
    const minPrice = Math.min(...priceValues) * 0.95;
    const rangePrice = maxPrice - minPrice;

    // Map to coordinates
    const equityPoints = history.map((day, idx) => {
      const x = padding.left + (idx / (history.length - 1)) * graphWidth;
      const y = padding.top + graphHeight - ((day.equity - minEquity) / rangeEquity) * graphHeight;
      return `${x},${y}`;
    });

    const pricePoints = history.map((day, idx) => {
      const x = padding.left + (idx / (history.length - 1)) * graphWidth;
      const y = padding.top + graphHeight - ((day.price - minPrice) / rangePrice) * graphHeight;
      return `${x},${y}`;
    });

    const equityPath = `M ${equityPoints.join(' L ')}`;
    const pricePath = `M ${pricePoints.join(' L ')}`;

    // Draw Grid Lines
    const gridRows = 3;
    const gridYLines = Array.from({ length: gridRows + 1 }).map((_, idx) => {
      const y = padding.top + (idx / gridRows) * graphHeight;
      const eqVal = maxEquity - (idx / gridRows) * rangeEquity;
      const prVal = maxPrice - (idx / gridRows) * rangePrice;
      return { y, eqVal, prVal };
    });

    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Grids */}
        {gridYLines.map((line, idx) => (
          <g key={idx}>
            <line 
              x1={padding.left} 
              y1={line.y} 
              x2={width - padding.right} 
              y2={line.y} 
              stroke="var(--border-subtle)" 
              strokeDasharray="4 4" 
            />
            {/* Left Y-axis labels (Equity) */}
            <text x={padding.left - 8} y={line.y + 3} fill="#00F0FF" fontSize="8" textAnchor="end" fontWeight="500">
              ${line.eqVal.toFixed(0)}
            </text>
            {/* Right Y-axis labels (Price) */}
            <text x={width - padding.right + 8} y={line.y + 3} fill="#A020F0" fontSize="8" textAnchor="start" fontWeight="500">
              ${line.prVal.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Date labels */}
        {[0, Math.floor(history.length / 2), history.length - 1].map((idx) => {
          const x = padding.left + (idx / (history.length - 1)) * graphWidth;
          return (
            <text key={idx} x={x} y={height - 8} fill="var(--text-muted)" fontSize="8" textAnchor="middle">
              {history[idx]?.date || ''}
            </text>
          );
        })}

        {/* Draw Stock Price curve (Purple) */}
        <path d={pricePath} fill="none" stroke="#A020F0" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
        
        {/* Draw Portfolio Equity curve (Neon Cyan) */}
        <path d={equityPath} fill="none" stroke="#00F0FF" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Strategy Parameters Selector */}
      <div className="glass-card" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', flex: 1 }}>
          
          {/* Strategy Selection */}
          <div className="input-group" style={{ margin: 0, minWidth: '220px' }}>
            <label>Trading Strategy Model</label>
            <select 
              value={strategyName} 
              onChange={(e) => setStrategyName(e.target.value)} 
              className="input-cyber"
            >
              <option value="transactionMomentum">Retail Transaction Momentum (Leading Signal)</option>
              <option value="smaCrossover">SMA Crossover (Lagging technicals)</option>
            </select>
          </div>

          {/* Ticker Selection */}
          <div className="input-group" style={{ margin: 0, minWidth: '100px' }}>
            <label>Stock Asset Ticker</label>
            <select 
              value={ticker} 
              onChange={(e) => setTicker(e.target.value)} 
              className="input-cyber"
            >
              <option value="TECH">TECH (Tech Inventory Index)</option>
              <option value="RETL">RETL (Retail Goods Index)</option>
            </select>
          </div>

          {/* Initial Capital */}
          <div className="input-group" style={{ margin: 0, minWidth: '120px' }}>
            <label>Starting Capital (USD)</label>
            <input 
              type="number" 
              value={initialCapital} 
              onChange={(e) => setInitialCapital(e.target.value)} 
              className="input-cyber"
            />
          </div>
        </div>

        <button 
          onClick={triggerBacktest} 
          disabled={loading} 
          className="btn btn-primary" 
          style={{ height: '42px', minWidth: '150px' }}
        >
          <Play size={14} fill="var(--bg-core)" /> Run Backtest
        </button>
      </div>

      {error && (
        <div className="badge badge-danger" style={{ padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* 2. Scorecard results */}
      {backtestResult && (
        <>
          <div className="kpi-grid">
            {/* KPI: Return on Investment */}
            <div className="glass-card kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kpi-label">Return on Investment (ROI)</span>
                <Percent size={16} className={backtestResult.roi >= 0 ? "trend-up" : "trend-down"} />
              </div>
              <div className="kpi-value" style={{ color: backtestResult.roi >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {backtestResult.roi >= 0 ? '+' : ''}{backtestResult.roi}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Absolute historical growth curve
              </div>
            </div>

            {/* KPI: Sharpe Ratio */}
            <div className="glass-card kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kpi-label">Sharpe Ratio (Annualized)</span>
                <Award size={16} style={{ color: 'var(--color-secondary)' }} />
              </div>
              <div className="kpi-value">{backtestResult.sharpeRatio}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Risk-adjusted return ratio (&gt; 1.0 is good)
              </div>
            </div>

            {/* KPI: Max Drawdown */}
            <div className="glass-card kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kpi-label">Max Drawdown</span>
                <TrendingUp size={16} className="trend-down" />
              </div>
              <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>
                -{backtestResult.maxDrawdown}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Peak-to-trough maximum drop
              </div>
            </div>

            {/* KPI: Final Portfolio Value */}
            <div className="glass-card kpi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="kpi-label">Final Portfolio Value</span>
                <DollarSign size={16} className="trend-up" />
              </div>
              <div className="kpi-value">
                ${backtestResult.finalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Cash: ${backtestResult.history[backtestResult.history.length-1].cash.toFixed(2)} &bull; Shares: {backtestResult.history[backtestResult.history.length-1].shares}
              </div>
            </div>
          </div>

          {/* 3. Equity chart vs Stock price chart */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Performance Curve Overlay</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Comparing strategy portfolio equity against asset index price.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', fontWeight: 500 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '3px', backgroundColor: '#00F0FF', display: 'inline-block' }}></span>
                  <span>Portfolio Equity (Left Y-Axis)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '3px', borderTop: '2px dotted #A020F0', display: 'inline-block' }}></span>
                  <span>Stock Index Price (Right Y-Axis)</span>
                </div>
              </div>
            </div>

            <div style={{ background: 'hsla(210, 40%, 98%, 0.01)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px 12px' }}>
              {renderDualChart()}
            </div>
            
            {/* Note on Strategy outperforming */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', background: 'hsla(180, 100%, 45%, 0.03)', border: '1px solid hsla(180, 100%, 45%, 0.12)', borderRadius: '8px', padding: '12px', fontSize: '0.82rem', alignItems: 'flex-start' }}>
              <Info size={16} style={{ color: 'var(--color-primary)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                {strategyName === 'transactionMomentum' ? (
                  <span>
                    <strong>Transaction Momentum Advantage:</strong> This strategy uses real-time product purchases in the DataMart as a leading proxy signal. By buying stock when retail demand grows, it triggers purchases <em>before</em> price increases are fully registered, yielding superior gains with look-ahead bias completely eliminated.
                  </span>
                ) : (
                  <span>
                    <strong>SMA Crossover Baseline:</strong> Standard technical moving averages are lagging indicators. By the time the short-term average crosses the long-term average, price trend movements have already occurred, leading to slower entry/exit times.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 4. Look ahead validator scrubber */}
          <LookAheadValidator history={backtestResult.history} />
        </>
      )}

    </div>
  );
}
