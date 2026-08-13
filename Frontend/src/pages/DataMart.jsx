import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lightbulb, TrendingUp, Sparkles, RefreshCw } from 'lucide-react';
import TransactionGrid from '../components/TransactionGrid.jsx';
import { formatCurrency } from '../utils/currency.js';

export default function DataMart({ transactions = [] }) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState([]);

  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/catalog');
      if (res.ok) {
        const data = await res.json();
        setCatalog(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [transactions]); // refresh whenever transactions update

  // Generate business insights dynamically using rule-based calculations
  useEffect(() => {
    const rules = [];

    // Rule 1: High concentration rule
    const totalRev = transactions.reduce((sum, t) => sum + t.totalPrice, 0);
    const techRev = transactions.filter(t => t.category === 'Tech').reduce((sum, t) => sum + t.totalPrice, 0);
    const retailRev = transactions.filter(t => t.category === 'Retail').reduce((sum, t) => sum + t.totalPrice, 0);

    if (totalRev > 0) {
      const techPercent = (techRev / totalRev) * 100;
      if (techPercent > 65) {
        rules.push({
          type: 'warning',
          title: 'Concentration Risk Detected',
          desc: `Technology hardware generates ${techPercent.toFixed(0)}% of total revenue. Consider promotional campaigns to boost retail items.`,
          icon: <ShieldAlert size={16} />
        });
      }
    }

    // Rule 2: Low Inventory check
    const lowStock = catalog.filter(p => p.inventory < 15);
    if (lowStock.length > 0) {
      rules.push({
        type: 'danger',
        title: 'Inventory Stock Depletion Warning',
        desc: `${lowStock.length} product(s) are below safety stock threshold (15 units): ${lowStock.map(p => `${p.name} (${p.inventory} left)`).join(', ')}.`,
        icon: <ShieldAlert size={16} />
      });
    }

    // Rule 3: Velocity Trend Spike
    // Check if the last 5 transactions contain multiple orders for the same product
    if (transactions.length >= 5) {
      const last5 = transactions.slice(0, 5);
      const productCounts = {};
      last5.forEach(t => {
        productCounts[t.productName] = (productCounts[t.productName] || 0) + t.quantity;
      });

      const trendingProduct = Object.entries(productCounts).find(([name, qty]) => qty >= 4);
      if (trendingProduct) {
        rules.push({
          type: 'info',
          title: 'Demand Spike Alert (Velocity Rule)',
          desc: `Order velocity for "${trendingProduct[0]}" has surged (purchased ${trendingProduct[1]} units within the last 5 logs). Strategy signal: Positive Momentum.`,
          icon: <TrendingUp size={16} />
        });
      }
    }

    // Rule 4: High Value Order Alert
    const highValOrder = transactions.find(t => t.totalPrice >= 1200);
    if (highValOrder) {
      rules.push({
        type: 'success',
        title: 'High-Value Ingestion Log',
        desc: `Large corporate transaction ingested: Tx ${highValOrder.id} generated ${formatCurrency(highValOrder.totalPrice)} for ${highValOrder.productName}.`,
        icon: <Sparkles size={16} />
      });
    }

    // Default general insight if nothing triggered
    if (rules.length === 0) {
      rules.push({
        type: 'info',
        title: 'Operations Stable',
        desc: 'Analytical indicators are green. Place more orders in the shopping page or run mock checkouts to trigger automated insights.',
        icon: <Lightbulb size={16} />
      });
    }

    setInsights(rules);
  }, [transactions, catalog]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Rule-Based Insights Section */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Rule-Based Business Insights</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Automated rules analyze current inventory and ingestion logs to generate operations alerts.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
          {insights.map((ins, i) => {
            let borderStyle = '1px solid var(--border-subtle)';
            let bgColor = 'hsla(210, 40%, 98%, 0.02)';
            let iconColor = 'var(--text-secondary)';

            if (ins.type === 'warning') {
              borderStyle = '1px solid hsla(41, 96%, 50%, 0.25)';
              bgColor = 'var(--color-warning-bg)';
              iconColor = 'var(--color-warning)';
            } else if (ins.type === 'danger') {
              borderStyle = '1px solid hsla(354, 82%, 56%, 0.25)';
              bgColor = 'var(--color-danger-bg)';
              iconColor = 'var(--color-danger)';
            } else if (ins.type === 'success') {
              borderStyle = '1px solid hsla(142, 76%, 45%, 0.25)';
              bgColor = 'var(--color-success-bg)';
              iconColor = 'var(--color-success)';
            } else if (ins.type === 'info') {
              borderStyle = '1px solid hsla(180, 100%, 45%, 0.2)';
              bgColor = 'var(--color-primary-glow)';
              iconColor = 'var(--color-primary)';
            }

            return (
              <div 
                key={i} 
                style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  padding: '12px 16px', 
                  background: bgColor, 
                  border: borderStyle, 
                  borderRadius: '8px',
                  alignItems: 'flex-start',
                  fontSize: '0.85rem'
                }}
              >
                <div style={{ color: iconColor, marginTop: '2px', flexShrink: 0 }}>
                  {ins.icon}
                </div>
                <div>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: '2px' }}>
                    {ins.title}
                  </strong>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {ins.desc}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Transaction Grid Ledger */}
      <TransactionGrid transactions={transactions} />

    </div>
  );
}
