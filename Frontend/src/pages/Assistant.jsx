<<<<<<< HEAD
import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, ShoppingCart, Sparkles, ShieldCheck } from 'lucide-react';

export default function Assistant({
  catalog = [],
  kpis = null,
  cart = [],
  addToCart = () => {},
  clearCart = () => {},
  checkoutCart = () => {},
  placeDirectPurchase = () => {},
  refreshAllData = () => {}
}) {
  const [query, setQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [meta, setMeta] = useState({ mode: 'rule_engine', llmEnabled: false });
  const [recommendations, setRecommendations] = useState([]);
  const [latestCards, setLatestCards] = useState({
    recommendations: [],
    cartPreview: [],
    kpiSnapshot: null,
    lowStockAlerts: []
  });
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: 'Welcome to the retail copilot. Ask for catalog items, KPIs, inventory, recommendations, cart updates, or checkout.'
    }
  ]);

  const sessionIdRef = useRef(localStorage.getItem('assistantSessionId') || `session_${Math.random().toString(36).slice(2)}`);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('assistantSessionId', sessionIdRef.current);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    setLatestCards(prev => ({
      ...prev,
      cartPreview: cart.slice(0, 4),
      kpiSnapshot: kpis,
      lowStockAlerts: catalog.filter(p => p.inventory < 15).slice(0, 4)
    }));
  }, [cart, kpis, catalog]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
  };

  const handleActions = async (actions = []) => {
    for (const action of actions) {
      switch (action.type) {
        case 'ADD_TO_CART':
          if (action.product && action.quantity) {
            addToCart(action.product, action.quantity);
          }
          break;
        case 'DIRECT_PURCHASE':
          if (action.product && action.quantity) {
            await placeDirectPurchase(action.product, action.quantity);
          }
          break;
        case 'CHECKOUT':
          await checkoutCart();
          break;
        case 'CLEAR_CART':
          clearCart();
          break;
        default:
          break;
      }
    }
  };

  const sendAssistantQuery = async (presetText) => {
    const text = (presetText || query).trim();
    if (!text) {
      return;
    }

    setMessages(prev => [...prev, { sender: 'user', text }]);
    if (!presetText) {
      setQuery('');
    }

    setIsTyping(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          cart,
          sessionId: sessionIdRef.current,
          userId: 'demo-user'
        })
      });

      const data = await response.json();
      setMessages(prev => [...prev, { sender: 'assistant', text: data.textResponse || 'No response generated.' }]);
      setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
      setLatestCards({
        recommendations: Array.isArray(data.recommendations) ? data.recommendations.slice(0, 3) : [],
        cartPreview: cart.slice(0, 4),
        kpiSnapshot: kpis,
        lowStockAlerts: catalog.filter(p => p.inventory < 15).slice(0, 4)
      });
      setMeta(data.meta || { mode: 'rule_engine', llmEnabled: false });
      await handleActions(data.actions || []);
      await refreshAllData();
    } catch (error) {
      setMessages(prev => [...prev, { sender: 'assistant', text: 'Connection issue: unable to reach assistant endpoint.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const quickPrompts = [
    'Show catalog',
    'Show KPIs',
    'Recommend a budget gift',
    'What is in my cart?',
    'Buy 1 Barista Brewer Pro'
  ];

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <div className="assistant-page-grid">
      <div className="glass-card assistant-console-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bot size={18} className="trend-up" />
            <h3 style={{ fontSize: '1.05rem' }}>Retail AI Assistant Console</h3>
          </div>
          <div className="badge badge-success" style={{ gap: '6px' }}>
            <ShieldCheck size={12} />
            {meta.mode === 'llm' ? 'LLM Mode' : 'Rule Engine'}
          </div>
        </div>

        <div className="chat-messages" style={{ flex: 1, minHeight: 0, borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
          {messages.map((msg, idx) => (
            <div key={idx} className={`chat-bubble ${msg.sender === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
              {msg.text.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          ))}
          {isTyping && (
            <div className="chat-bubble chat-bubble-assistant" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
              Generating response...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="quick-replies" style={{ padding: 0 }}>
          {quickPrompts.map((item) => (
            <button key={item} className="quick-reply-btn" onClick={() => sendAssistantQuery(item)}>
              {item}
            </button>
          ))}
        </div>

        <div className="chat-input-area" style={{ padding: 0, borderTop: 'none', background: 'transparent' }}>
          <input
            className="chat-input"
            placeholder="Ask: buy, add to cart, show KPIs, stock levels, recommendations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendAssistantQuery()}
          />
          <button className="btn btn-primary" onClick={() => sendAssistantQuery()}>
            <Send size={14} /> Send
          </button>
        </div>
      </div>

      <div className="assistant-side-column">
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem' }}>Smart Recommendations</h3>
            <Sparkles size={14} style={{ color: 'var(--color-secondary)' }} />
          </div>
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recommendations.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Ask for a recommendation to populate this panel.</div>
            ) : (
              recommendations.map((rec) => (
                <div key={rec.id} className="assistant-rec-card">
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{rec.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>{rec.reason}</div>
                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>${rec.price?.toFixed(2)}</strong>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                      onClick={() => {
                        const prod = catalog.find(p => p.id === rec.id);
                        if (prod) addToCart(prod, 1);
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '1rem' }}>Cart Snapshot</h3>
            <ShoppingCart size={14} className="trend-up" />
          </div>
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {cart.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No items in cart yet.</div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>{item.product.name} x{item.quantity}</span>
                  <strong>${(item.product.price * item.quantity).toFixed(2)}</strong>
                </div>
              ))
            )}
          </div>
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total</span>
            <strong>${cartTotal.toFixed(2)}</strong>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => checkoutCart()}>Checkout</button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => clearCart()}>Clear</button>
          </div>
        </div>

        <div className="glass-card">
          <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>KPI Snapshot</h3>
          {latestCards.kpiSnapshot ? (
            <div className="assistant-mini-list">
              <div className="assistant-mini-row"><span>Revenue</span><strong>{formatCurrency(latestCards.kpiSnapshot.totalRevenue)}</strong></div>
              <div className="assistant-mini-row"><span>Orders</span><strong>{latestCards.kpiSnapshot.totalOrders || 0}</strong></div>
              <div className="assistant-mini-row"><span>Avg Ticket</span><strong>{formatCurrency(latestCards.kpiSnapshot.avgOrderValue)}</strong></div>
              <div className="assistant-mini-row"><span>TECH / RETL</span><strong>${latestCards.kpiSnapshot.currentStocks?.TECH?.toFixed(2)} / ${latestCards.kpiSnapshot.currentStocks?.RETL?.toFixed(2)}</strong></div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>KPI data unavailable.</div>
          )}
        </div>

        <div className="glass-card">
          <h3 style={{ fontSize: '1rem', marginBottom: '10px' }}>Low-Stock Alerts</h3>
          {latestCards.lowStockAlerts.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No low-stock products right now.</div>
          ) : (
            <div className="assistant-mini-list">
              {latestCards.lowStockAlerts.map((p) => (
                <div key={p.id} className="assistant-mini-row">
                  <span>{p.name}</span>
                  <strong className="trend-down">{p.inventory} left</strong>
                </div>
              ))}
            </div>
          )}
        </div>
=======
import React from 'react';

export default function Assistant({ catalog = [], cart = [], addToCart = () => {}, clearCart = () => {}, checkoutCart = () => {}, placeDirectPurchase = () => {}, refreshAllData = () => {} }) {
  return (
    <div style={{ padding: 20 }}>
      <h3>AI Retail Assistant</h3>
      <p>This is a lightweight placeholder for the Assistant page.</p>

      <section>
        <h4>Catalog</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {catalog.length === 0 ? (
            <div>No catalog items available.</div>
          ) : (
            catalog.map(item => (
              <div key={item.id} style={{ border: '1px solid #ddd', padding: 8, borderRadius: 6 }}>
                <div style={{ fontWeight: 600 }}>{item.name || item.title}</div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>{item.description || ''}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button onClick={() => addToCart(item, 1)} className="btn">Add</button>
                  <button onClick={() => placeDirectPurchase(item, 1)} className="btn btn-secondary">Buy 1</button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        <h4>Cart</h4>
        {cart.length === 0 ? (
          <div>No items in cart.</div>
        ) : (
          <div>
            <ul>
              {cart.map((c, idx) => (
                <li key={idx}>{c.product?.name || c.product?.title} x {c.quantity}</li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={checkoutCart} className="btn">Checkout</button>
              <button onClick={clearCart} className="btn btn-secondary">Clear</button>
            </div>
          </div>
        )}
      </section>

      <div style={{ marginTop: 18 }}>
        <button onClick={refreshAllData} className="btn">Refresh Data</button>
>>>>>>> kairavi
      </div>
    </div>
  );
}
