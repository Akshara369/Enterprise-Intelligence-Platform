import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Database, 
  Bot, 
  FileText, 
  RefreshCw, 
  ShoppingCart, 
  Wifi, 
  WifiOff,
  LogOut 
} from 'lucide-react';

// Import Pages
import Dashboard from './pages/Dashboard.jsx';
import Backtesting from './pages/Backtesting.jsx';
import DataMart from './pages/DataMart.jsx';
import Assistant from './pages/Assistant.jsx';
import DevReport from './pages/DevReport.jsx';
import LoginPage from './auth/LoginPage.jsx';

// Import Floating Widget
import AssistantWidget from './components/AssistantWidget.jsx';

function App() {
  const [activePage, setActivePage] = useState('Dashboard');
  const [cart, setCart] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [apiStatus, setApiStatus] = useState(false);
  const [lastNotification, setLastNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof window === 'undefined') return 'Guest';
    return localStorage.getItem('eintel_username') || 'Guest';
  });

  const handleLogin = (username) => {
    const cleanUsername = username || 'Guest';
    localStorage.setItem('eintel_username', cleanUsername);
    localStorage.setItem('eintel_is_logged_in', 'true');
    setCurrentUser(cleanUsername);
    setIsAuthenticated(true);
    setActivePage('Dashboard');
  };

  const handleSignOut = () => {
    localStorage.removeItem('eintel_username');
    localStorage.setItem('eintel_is_logged_in', 'false');
    setCurrentUser('Guest');
    setIsAuthenticated(false);
    setActivePage('Dashboard');
  };

  // Fetch all states from the server
  const refreshAllData = useCallback(async () => {
    try {
      const [catRes, txRes, stockRes, kpiRes] = await Promise.all([
        fetch('/api/catalog'),
        fetch('/api/transactions'),
        fetch('/api/stocks'),
        fetch('/api/kpis')
      ]);

      if (catRes.ok && txRes.ok && stockRes.ok && kpiRes.ok) {
        const catData = await catRes.json();
        const txData = await txRes.json();
        const stockData = await stockRes.json();
        const kpiData = await kpiRes.json();

        setCatalog(catData);
        setTransactions(txData);
        setStocks(stockData);
        setKpis(kpiData);
        setApiStatus(true);
      } else {
        setApiStatus(false);
      }
    } catch (error) {
      console.error("Failed to sync with API backend:", error);
      setApiStatus(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run initial loading
  useEffect(() => {
    refreshAllData();
    // Setup background interval to refresh stock prices and KPIs
    const interval = setInterval(refreshAllData, 5000);
    return () => clearInterval(interval);
  }, [refreshAllData]);

  // Action: Add to cart
  const addToCart = (product, quantity) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.product.id === product.id);
      if (existing) {
        return prevCart.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
      }
      return [...prevCart, { product, quantity }];
    });
  };

  // Action: Clear Cart
  const clearCart = () => setCart([]);

  // Action: Direct Purchase
  const placeDirectPurchase = async (product, quantity) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity })
      });
      if (response.ok) {
        const newTx = await response.json();
        setLastNotification(`Order Success: ${quantity}x ${product.name} ingested!`);
        setTimeout(() => setLastNotification(null), 4000);
        refreshAllData();
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  // Action: Complete Cart Checkout
  const checkoutCart = async () => {
    if (cart.length === 0) return false;
    try {
      const response = await fetch('/api/transactions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartItems: cart })
      });
      if (response.ok) {
        setCart([]);
        setLastNotification(`Checkout complete. ${cart.length} product(s) ingested into DataMart!`);
        setTimeout(() => setLastNotification(null), 5000);
        refreshAllData();
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  // Action: Reset Sandbox
  const resetSandbox = async () => {
    if (!window.confirm("Are you sure you want to reset all sandbox transactional and stock simulation logs?")) return;
    try {
      const response = await fetch('/api/reset', { method: 'POST' });
      if (response.ok) {
        setCart([]);
        setLastNotification("Sandbox database reset successfully.");
        setTimeout(() => setLastNotification(null), 3000);
        refreshAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      {/* 1. Sidebar Panel */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">E</div>
          <span className="brand-text">E-Intel Platform</span>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={`sidebar-nav-item ${activePage === 'Dashboard' ? 'active' : ''}`}
            onClick={() => setActivePage('Dashboard')}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          
          <button 
            className={`sidebar-nav-item ${activePage === 'Backtesting' ? 'active' : ''}`}
            onClick={() => setActivePage('Backtesting')}
          >
            <TrendingUp size={18} />
            Backtester
          </button>
          
          <button 
            className={`sidebar-nav-item ${activePage === 'DataMart' ? 'active' : ''}`}
            onClick={() => setActivePage('DataMart')}
          >
            <Database size={18} />
            DataMart Analytics
          </button>
          
          <button 
            className={`sidebar-nav-item ${activePage === 'Assistant' ? 'active' : ''}`}
            onClick={() => setActivePage('Assistant')}
          >
            <Bot size={18} />
            AI Retail Assistant
          </button>
          
          <button 
            className={`sidebar-nav-item ${activePage === 'DevReport' ? 'active' : ''}`}
            onClick={() => setActivePage('DevReport')}
          >
            <FileText size={18} />
            Developer Report
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info-row">
            <span className="signed-in-label">Signed in as</span>
            <span className="signed-in-user">{currentUser}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {apiStatus ? (
              <Wifi size={14} className="trend-up" />
            ) : (
              <WifiOff size={14} className="trend-down" />
            )}
            <span>Backend: {apiStatus ? "Connected" : "Disconnected"}</span>
          </div>

          <button onClick={handleSignOut} className="btn btn-secondary sidebar-signout-btn">
            <LogOut size={12} /> Sign out
          </button>

          <button onClick={resetSandbox} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem', width: '100%' }}>
            <RefreshCw size={12} /> Reset Sandbox
          </button>
          <div style={{ fontSize: '0.7rem' }}>© 2026 E-Intel Corp</div>
        </div>
      </aside>

      {/* 2. Main Body Content */}
      <main className="main-content">
        {/* Ticker Notifications */}
        {lastNotification && (
          <div className="ticker-banner">
            <div className="ticker-pulse"></div>
            <span>🚨 <strong>UNIFIED LOOP INGESTION TRIGGERED:</strong> {lastNotification}</span>
          </div>
        )}

        <header className="main-header">
          <div className="header-title-container">
            <h2>{activePage === 'DevReport' ? 'Developer Report' : activePage}</h2>
          </div>
          
          <div className="header-actions">
            {cart.length > 0 && (
              <button 
                onClick={() => setActivePage('Assistant')} 
                className="btn btn-secondary" 
                style={{ display: 'flex', gap: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <ShoppingCart size={16} className="trend-up" />
                Cart ({cart.reduce((sum, i) => sum + i.quantity, 0)})
              </button>
            )}
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Sandbox Mode
            </div>
          </div>
        </header>

        {/* Page Routing */}
        <section className="page-container">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
              <RefreshCw size={36} className="trend-up" style={{ animation: 'spin 2s linear infinite' }} />
            </div>
          ) : (
            <>
              {activePage === 'Dashboard' && (
                <Dashboard 
                  kpis={kpis} 
                  stocks={stocks} 
                  transactions={transactions} 
                  setActivePage={setActivePage} 
                />
              )}
              {activePage === 'Backtesting' && (
                <Backtesting 
                  stocks={stocks} 
                />
              )}
              {activePage === 'DataMart' && (
                <DataMart 
                  transactions={transactions} 
                />
              )}
              {activePage === 'Assistant' && (
                <Assistant 
                  catalog={catalog} 
                  kpis={kpis}
                  cart={cart}
                  addToCart={addToCart}
                  clearCart={clearCart}
                  checkoutCart={checkoutCart}
                  placeDirectPurchase={placeDirectPurchase}
                  refreshAllData={refreshAllData}
                />
              )}
              {activePage === 'DevReport' && (
                <DevReport />
              )}
            </>
          )}
        </section>
      </main>

      {/* Floating Assistant Widget (visible on all pages except the Assistant page) */}
      {activePage !== 'Assistant' && (
        <AssistantWidget 
          catalog={catalog}
          kpis={kpis}
          cart={cart}
          addToCart={addToCart}
          clearCart={clearCart}
          checkoutCart={checkoutCart}
          placeDirectPurchase={placeDirectPurchase}
          setActivePage={setActivePage}
        />
      )}
    </div>
  );
}

export default App;
