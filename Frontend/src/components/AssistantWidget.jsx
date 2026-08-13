import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, ShoppingBag } from 'lucide-react';
import { formatCurrency } from '../utils/currency.js';

export default function AssistantWidget({ catalog = [], kpis = null, cart = [], addToCart, clearCart, checkoutCart, placeDirectPurchase, setActivePage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [assistantMode, setAssistantMode] = useState('rule_engine');
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [latestCards, setLatestCards] = useState({
    recommendations: [],
    cartPreview: [],
    kpiSnapshot: null,
    lowStockAlerts: []
  });
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: "Hello! I am your Enterprise Retail AI. Ask me to browse products, check stock, look at business KPIs, or add things to your cart."
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const sessionIdRef = useRef(localStorage.getItem('assistantSessionId') || `session_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    localStorage.setItem('assistantSessionId', sessionIdRef.current);
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  useEffect(() => {
    setLatestCards(prev => ({
      ...prev,
      cartPreview: cart.slice(0, 3),
      kpiSnapshot: kpis,
      lowStockAlerts: catalog.filter(p => p.inventory < 15).slice(0, 2)
    }));
  }, [cart, kpis, catalog]);

  const handleSend = async (textToSend) => {
    const text = textToSend || query;
    if (!text.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { sender: 'user', text }]);
    if (!textToSend) setQuery('');

    setIsTyping(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, cart, sessionId: sessionIdRef.current, userId: 'demo-user' })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.meta) {
          setAssistantMode(data.meta.mode || 'rule_engine');
          setLlmEnabled(Boolean(data.meta.llmEnabled));
        }
        setLatestCards({
          recommendations: Array.isArray(data.recommendations) ? data.recommendations.slice(0, 2) : [],
          cartPreview: cart.slice(0, 3),
          kpiSnapshot: kpis,
          lowStockAlerts: catalog.filter(p => p.inventory < 15).slice(0, 2)
        });
        
        setIsTyping(false);
        setMessages(prev => [...prev, { sender: 'assistant', text: data.textResponse }]);

        // Process execution callbacks from chatbot parser actions
        if (data.actions && data.actions.length > 0) {
          for (const action of data.actions) {
            switch (action.type) {
              case 'ADD_TO_CART':
                addToCart(action.product, action.quantity);
                break;
              case 'DIRECT_PURCHASE':
                await placeDirectPurchase(action.product, action.quantity);
                break;
              case 'CHECKOUT':
                await checkoutCart();
                break;
              case 'CLEAR_CART':
                clearCart();
                break;
              case 'SHOW_KPIS':
                setActivePage('DataMart');
                break;
              case 'SHOW_CATALOG':
              case 'SHOW_CART':
              case 'SHOW_INVENTORY':
                setActivePage('Assistant');
                break;
              default:
                break;
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
      setIsTyping(false);
      setMessages(prev => [...prev, { sender: 'assistant', text: "Network connection error with backend NLP parser." }]);
    }
  };

  const quickActions = [
    "Buy 1 Barista Brewer Pro",
    "Show KPIs",
    "Check Stock Levels",
    "What is in my cart?"
  ];

  return (
    <div className="floating-widget-container">
      {/* 1. Chat Widget Window */}
      {isOpen && (
        <div className="floating-widget-panel">
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-status"></div>
              <div>
                <strong style={{ fontSize: '0.85rem' }}>Retail AI Assistant</strong>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {assistantMode === 'llm' ? 'Connected (LLM + Tools)' : 'Connected (Rule Engine)'}
                  {!llmEnabled && ' - API key not set'}
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Chat message space */}
          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`chat-bubble ${msg.sender === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}
              >
                {msg.text.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            ))}
            {isTyping && (
              <div className="chat-bubble chat-bubble-assistant" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                Parsing query...
              </div>
            )}
            <div ref={messagesEndRef} />

            {(latestCards.recommendations.length > 0 || latestCards.cartPreview.length > 0 || latestCards.kpiSnapshot || latestCards.lowStockAlerts.length > 0) && (
              <div className="assistant-widget-cards">
                {latestCards.recommendations.length > 0 && (
                  <div className="assistant-widget-card">
                    <div className="assistant-widget-card-title">Recommendations</div>
                    {latestCards.recommendations.map((rec) => (
                      <div key={rec.id} className="assistant-widget-row">
                        <span>{rec.name}</span>
                        <strong>{formatCurrency(rec.price)}</strong>
                      </div>
                    ))}
                  </div>
                )}

                <div className="assistant-widget-card">
                  <div className="assistant-widget-card-title">Cart Preview</div>
                  {latestCards.cartPreview.length === 0 ? (
                    <div className="assistant-widget-empty">Empty</div>
                  ) : (
                    latestCards.cartPreview.map((item) => (
                      <div key={item.product.id} className="assistant-widget-row">
                        <span>{item.product.name} x{item.quantity}</span>
                        <strong>{formatCurrency(item.product.price * item.quantity)}</strong>
                      </div>
                    ))
                  )}
                </div>

                {latestCards.kpiSnapshot && (
                  <div className="assistant-widget-card">
                    <div className="assistant-widget-card-title">KPI Snapshot</div>
                    <div className="assistant-widget-row"><span>Revenue</span><strong>{formatCurrency(latestCards.kpiSnapshot.totalRevenue)}</strong></div>
                    <div className="assistant-widget-row"><span>Orders</span><strong>{latestCards.kpiSnapshot.totalOrders}</strong></div>
                  </div>
                )}

                {latestCards.lowStockAlerts.length > 0 && (
                  <div className="assistant-widget-card">
                    <div className="assistant-widget-card-title">Low-Stock Alerts</div>
                    {latestCards.lowStockAlerts.map((product) => (
                      <div key={product.id} className="assistant-widget-row">
                        <span>{product.name}</span>
                        <strong className="trend-down">{product.inventory}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions Suggestions */}
          <div className="quick-replies">
            {quickActions.map((action, i) => (
              <button 
                key={i} 
                className="quick-reply-btn" 
                onClick={() => handleSend(action)}
              >
                {action}
              </button>
            ))}
          </div>

          {/* Input field */}
          <div className="chat-input-area">
            <input
              type="text"
              placeholder="Ask anything, e.g. 'buy 2 headphones'..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="chat-input"
              style={{ fontSize: '0.85rem', padding: '8px 12px' }}
            />
            <button 
              onClick={() => handleSend()} 
              className="btn btn-primary" 
              style={{ padding: '8px 12px', minWidth: '40px' }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 2. Floating Circular Trigger Button */}
      <button 
        className="floating-widget-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle assistant widget"
      >
        {isOpen ? <X size={22} /> : <Bot size={22} />}
        {cart.length > 0 && !isOpen && (
          <div style={{
            position: 'absolute',
            top: -4,
            left: -4,
            background: 'var(--color-secondary)',
            color: 'var(--text-primary)',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '0.65rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 8px var(--color-secondary-glow)'
          }}>
            {cart.reduce((sum, item) => sum + item.quantity, 0)}
          </div>
        )}
      </button>
    </div>
  );
}
