import React, { useState } from 'react';
import { ArrowUpDown, Search, Filter } from 'lucide-react';

export default function TransactionGrid({ transactions = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // Sort state
  const [sortField, setSortField] = useState('timestamp');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // default to desc on new field
    }
  };

  // Filter and search transactions
  const filtered = transactions.filter(tx => {
    const matchesSearch = 
      tx.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      tx.productName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = 
      categoryFilter === 'All' || 
      tx.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Sort transactions
  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    // Handle string parsing for dates
    if (sortField === 'timestamp') {
      valA = new Date(a.timestamp).getTime();
      valB = new Date(b.timestamp).getTime();
    }

    if (typeof valA === 'string') {
      return sortDirection === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    } else {
      return sortDirection === 'asc' 
        ? valA - valB 
        : valB - valA;
    }
  });

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Search and Filters Header */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Real-time Ingestion Ledger</h3>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Text Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search ID or Product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-cyber"
              style={{ paddingLeft: '32px', width: '200px', height: '36px' }}
            />
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '0 10px', height: '36px' }}>
            <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="All" style={{ background: 'var(--bg-core)' }}>All Categories</option>
              <option value="Tech" style={{ background: 'var(--bg-core)' }}>Tech</option>
              <option value="Retail" style={{ background: 'var(--bg-core)' }}>Retail</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table grid */}
      <div className="table-container">
        {sorted.length === 0 ? (
          <div style={{ padding: '40px 0', textCenter: 'center', color: 'var(--text-secondary)', textAlign: 'center' }}>
            No transaction events found. Go place some orders in the AI assistant!
          </div>
        ) : (
          <table className="cyber-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('id')}>
                  Tx ID <ArrowUpDown size={12} style={{ marginLeft: '4px', display: 'inline' }} />
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('timestamp')}>
                  Timestamp <ArrowUpDown size={12} style={{ marginLeft: '4px', display: 'inline' }} />
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('productName')}>
                  Product <ArrowUpDown size={12} style={{ marginLeft: '4px', display: 'inline' }} />
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('category')}>
                  Category <ArrowUpDown size={12} style={{ marginLeft: '4px', display: 'inline' }} />
                </th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('quantity')}>
                  Qty <ArrowUpDown size={12} style={{ marginLeft: '4px', display: 'inline' }} />
                </th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('price')}>
                  Item Price <ArrowUpDown size={12} style={{ marginLeft: '4px', display: 'inline' }} />
                </th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('totalPrice')}>
                  Total <ArrowUpDown size={12} style={{ marginLeft: '4px', display: 'inline' }} />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((tx) => (
                <tr key={tx.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {tx.id}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {new Date(tx.timestamp).toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {tx.productName}
                  </td>
                  <td>
                    <span className={`badge ${tx.category === 'Tech' ? 'badge-tech' : 'badge-retail'}`}>
                      {tx.category}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {tx.quantity}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                    ${tx.price.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ${tx.totalPrice.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Total statistics summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
        <span>Showing {sorted.length} of {transactions.length} ingested records</span>
        {sorted.length > 0 && (
          <span>Total Ingested Value: <strong>${sorted.reduce((sum, item) => sum + item.totalPrice, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></span>
        )}
      </div>
    </div>
  );
}
