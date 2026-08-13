import React from 'react';
import { IndianRupee, ShoppingCart, Percent, TrendingUp, ArrowRight } from 'lucide-react';
import { AreaChart, BarChart, DonutChart } from '../components/SvgCharts.jsx';
import { formatCurrency } from '../utils/currency.js';

export default function Dashboard({ kpis, stocks = [], transactions = [], setActivePage }) {
  const currentTechStock = kpis?.currentStocks?.TECH || 150.00;
  const currentRetailStock = kpis?.currentStocks?.RETL || 80.00;

  // Filter last 5 transactions for the activity feed
  const recentTransactions = transactions.slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      
      {/* 1. KPIs Scorecards Row */}
      <div className="kpi-grid">
        {/* KPI: Revenue */}
        <div className="glass-card kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-label">Total Revenue</span>
            <IndianRupee size={16} className="trend-up" />
          </div>
          <div className="kpi-value">{formatCurrency(kpis?.totalRevenue)}</div>
          <div className="kpi-trend trend-up">
            +14.2% <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>from last week</span>
          </div>
        </div>

        {/* KPI: Orders */}
        <div className="glass-card kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-label">Total Orders</span>
            <ShoppingCart size={16} style={{ color: 'var(--color-secondary)' }} />
          </div>
          <div className="kpi-value">{kpis?.totalOrders || 0}</div>
          <div className="kpi-trend trend-up">
            +8.6% <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>ingested logs</span>
          </div>
        </div>

        {/* KPI: Avg Order Value */}
        <div className="glass-card kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-label">Avg Order Value</span>
            <Percent size={16} style={{ color: 'var(--color-accent-teal)' }} />
          </div>
          <div className="kpi-value">{formatCurrency(kpis?.avgOrderValue)}</div>
          <div className="kpi-trend trend-up">
            +5.1% <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>average ticket</span>
          </div>
        </div>

        {/* KPI: Active Stock Simulator Prices */}
        <div className="glass-card kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="kpi-label">Market Sim (TECH / RETL)</span>
            <TrendingUp size={16} className="trend-up" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span>TECH Ticker:</span>
              <strong style={{ color: '#00F0FF' }}>{formatCurrency(currentTechStock)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginTop: '2px' }}>
              <span>RETL Ticker:</span>
              <strong style={{ color: '#A020F0' }}>{formatCurrency(currentRetailStock)}</strong>
            </div>
          </div>
          <div className="kpi-trend" style={{ color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px', fontSize: '0.75rem' }}>
            Updating live via consumer velocity
          </div>
        </div>
      </div>

      {/* 2. Charts and Visualization Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', flexWrap: 'wrap' }} className="validator-grid">
        
        {/* Stock Price Curve */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Simulated stock index history (TECH)</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Last 30 Days</span>
          </div>
          <AreaChart data={stocks} dataKey="TECH" strokeColor="#00F0FF" />
        </div>

        {/* Donut Category Sales breakdown */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Revenue Split</h3>
          <DonutChart 
            techValue={kpis?.categorySales?.Tech || 0} 
            retailValue={kpis?.categorySales?.Retail || 0} 
          />
        </div>
      </div>

      {/* 3. Daily transaction frequency and recent activity logs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="validator-grid">
        
        {/* Daily Volume Bar chart */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Daily Transaction Volume Velocity</h3>
          <BarChart data={stocks} />
        </div>

        {/* Live Activity Ingestion Feed */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Real-time Activity Stream</h3>
            <button 
              className="btn btn-secondary" 
              onClick={() => setActivePage('DataMart')}
              style={{ display: 'flex', gap: '4px', padding: '6px 12px', fontSize: '0.75rem' }}
            >
              View All <ArrowRight size={12} />
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              No transactional ingestion logs. Use the chat assistant to order products!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              {recentTransactions.map((tx) => (
                <div 
                  key={tx.id} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '10px 14px', 
                    background: 'hsla(210, 40%, 98%, 0.02)', 
                    border: '1px solid var(--border-subtle)', 
                    borderRadius: '8px',
                    fontSize: '0.85rem'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontWeight: 600 }}>{tx.productName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ID: <span style={{ color: 'var(--color-primary)' }}>{tx.id}</span> &bull; {new Date(tx.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>+{formatCurrency(tx.totalPrice)}</div>
                    <span className={`badge ${tx.category === 'Tech' ? 'badge-tech' : 'badge-retail'}`} style={{ fontSize: '0.6rem', padding: '2px 6px', marginTop: '2px' }}>
                      {tx.category} x{tx.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
