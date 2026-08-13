import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, ShoppingBag } from 'lucide-react';

export default function AssistantWidget({ cart = [], addToCart, clearCart, checkoutCart, placeDirectPurchase, setActivePage }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: "Hello! I am your Enterprise Retail AI. Ask me to browse products, check stock, look at business KPIs, or add things to your cart."
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

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
        body: JSON.stringify({ query: text, cart })
      });

      if (response.ok) {
        const data = await response.json();
        
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
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Connected (Offline NLP)</div>
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
