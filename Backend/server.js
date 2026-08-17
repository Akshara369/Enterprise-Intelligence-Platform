import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB, resetDatabase } from './config/db.js';
import Product from './models/Product.js';
import Transaction from './models/Transaction.js';
import StockHistory from './models/StockHistory.js';
import mongoose from 'mongoose';
import productRouter from './routes/products.js';

import {
  searchProducts,
  recommendProducts,
  getProductDetails,
  checkInventory
} from './services/productService.js';

import {
  getSalesKPIs,
  getTopProducts,
  getCategoryPerformance
} from './services/dataMartService.js';

// --- Production/scalability hardening imports ---
import { config } from './config/env.js';
import { logger, httpLogger } from './config/logger.js';
import { errorHandler, notFoundHandler, registerProcessSafetyNets } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';
import { healthRouter } from './routes/health.js';
import { metricsCollector, metricsRouter } from './routes/metrics.js';

registerProcessSafetyNets(logger);

const app = express();
const PORT = config.port || process.env.PORT || 5000;
const DEMO_USER = Object.freeze({ id: 'user_admin', username: 'admin', password: 'admin', name: 'Platform Administrator', role: 'Administrator' });
const authTokens = new Map();
const assistantSessions = new Map();
const assistantMetrics = { totalRequests: 0, ruleEngineResponses: 0, actionCalls: 0, lastRequestAt: null };
const assistantToolsByType = {
  recommendations: 'recommendProducts',
  inventory: 'checkInventory',
  product_details: 'getProductDetails',
  cart_action: 'Cart',
  cart_status: 'Cart',
  catalog: 'searchProducts',
  product_search: 'searchProducts',
};

function publicUser(user) { return { id: user.id, username: user.username, name: user.name, role: user.role }; }
function getAuthToken(req) { return req.headers.authorization?.replace(/^Bearer\s+/i, ''); }
function requireAdmin(req, res, next) {
  const user = authTokens.get(getAuthToken(req));
  if (!user) return res.status(401).json({ error: 'Authentication is required.' });
  if (user.role !== 'Administrator') return res.status(403).json({ error: 'Administrator access is required.' });
  req.user = user;
  next();
}
function withTimeout(promise, timeoutMs = 2500) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs))]);
}
async function probeService(name, path, check) {
  const startedAt = performance.now();
  try {
    const detail = await withTimeout(check());
    return { name, path, status: 'Healthy', httpStatus: 200, latencyMs: Math.round(performance.now() - startedAt), detail };
  } catch (error) {
    return { name, path, status: 'Down', httpStatus: 503, latencyMs: Math.round(performance.now() - startedAt), detail: error.message };
  }
}
function getAssistantTool(resultType = '') {
  if (resultType.startsWith('datamart')) return 'DataMart';
  return assistantToolsByType[resultType] || 'searchProducts';
}

app.use(cors({ origin: config.corsOrigin || '*' }));
app.use(express.json());
app.use(httpLogger); // structured request logging
app.use(metricsCollector); // prometheus request metrics
app.use(healthRouter); // /health and /ready
app.use(metricsRouter); // /metrics
app.use('/api', generalLimiter); // baseline rate limit for API routes
app.use('/api/products', productRouter);

// Initialize MongoDB Connection
connectDB();

// Helper: Simulate stock price update after placing an order
async function simulatePriceImpact(category, quantity) {
  const latestStock = await StockHistory.findOne().sort({ date: -1 });
  if (latestStock) {
    const impactFactor = category === 'Tech' ? 0.8 : 0.4;
    const impact = quantity * impactFactor;
    if (category === 'Tech') {
      latestStock.TECH = parseFloat((latestStock.TECH + impact).toFixed(2));
    } else {
      latestStock.RETL = parseFloat((latestStock.RETL + impact).toFixed(2));
    }
    await latestStock.save();
  }
}

// ==========================================
// 1. BACKTESTER ENGINE (LOOK-AHEAD BIAS-FREE)
// ==========================================

function runBacktest(stocksHistoricalData, strategyName, ticker, initialCapital = 10000) {
  let cash = initialCapital;
  let shares = 0;
  let portfolioHistory = [];
  let tradesLog = [];

  const days = stocksHistoricalData.length;
  if (days < 5) return { error: 'Insufficient data for backtest' };

  for (let t = 0; t < days; t++) {
    const currentDayData = stocksHistoricalData[t];
    const currentDate = currentDayData.date;
    const price = currentDayData[ticker];

    const historicalSlice = stocksHistoricalData.slice(0, t + 1);
    const sliceCount = historicalSlice.length;

    let signal = 'HOLD';

    if (strategyName === 'transactionMomentum') {
      if (sliceCount >= 10) {
        const volumeField = ticker === 'TECH' ? 'techVolume' : 'retailVolume';
        
        let sumShort = 0;
        for (let i = 0; i < 3; i++) {
          sumShort += historicalSlice[sliceCount - 1 - i][volumeField];
        }
        const avgShort = sumShort / 3;

        let sumLong = 0;
        for (let i = 0; i < 10; i++) {
          sumLong += historicalSlice[sliceCount - 1 - i][volumeField];
        }
        const avgLong = sumLong / 10;

        if (avgShort > avgLong * 1.1) {
          signal = 'BUY';
        } else if (avgShort < avgLong * 0.9) {
          signal = 'SELL';
        }
      }
    } else if (strategyName === 'smaCrossover') {
      if (sliceCount >= 15) {
        let sum5 = 0;
        for (let i = 0; i < 5; i++) {
          sum5 += historicalSlice[sliceCount - 1 - i][ticker];
        }
        const sma5 = sum5 / 5;

        let sum15 = 0;
        for (let i = 0; i < 15; i++) {
          sum15 += historicalSlice[sliceCount - 1 - i][ticker];
        }
        const sma15 = sum15 / 15;

        if (sma5 > sma15) {
          signal = 'BUY';
        } else if (sma5 < sma15) {
          signal = 'SELL';
        }
      }
    }

    if (signal === 'BUY' && cash > 0) {
      const sharesToBuy = Math.floor(cash / price);
      if (sharesToBuy > 0) {
        const cost = sharesToBuy * price;
        cash = parseFloat((cash - cost).toFixed(2));
        shares += sharesToBuy;
        tradesLog.push({
          date: currentDate,
          type: 'BUY',
          price: price,
          shares: sharesToBuy,
          cashAfter: cash,
          portfolioValue: parseFloat((cash + shares * price).toFixed(2))
        });
      }
    } else if (signal === 'SELL' && shares > 0) {
      const revenue = shares * price;
      cash = parseFloat((cash + revenue).toFixed(2));
      tradesLog.push({
        date: currentDate,
        type: 'SELL',
        price: price,
        shares: shares,
        cashAfter: cash,
        portfolioValue: cash
      });
      shares = 0;
    }

    const totalVal = parseFloat((cash + shares * price).toFixed(2));
    portfolioHistory.push({
      date: currentDate,
      price: price,
      equity: totalVal,
      cash: cash,
      shares: shares,
      signalToday: signal
    });
  }

  const finalValue = portfolioHistory[portfolioHistory.length - 1].equity;
  const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;
  
  let dailyReturns = [];
  for (let i = 1; i < portfolioHistory.length; i++) {
    const prev = portfolioHistory[i - 1].equity;
    const curr = portfolioHistory[i].equity;
    dailyReturns.push((curr - prev) / prev);
  }
  
  const avgDailyReturn = dailyReturns.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, val) => sum + Math.pow(val - avgDailyReturn, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);
  
  const annualSharpe = stdDev > 0 ? parseFloat(((avgDailyReturn / stdDev) * Math.sqrt(252)).toFixed(2)) : 0;

  let peak = -Infinity;
  let maxDrawdown = 0;
  portfolioHistory.forEach(day => {
    if (day.equity > peak) {
      peak = day.equity;
    }
    const dd = (peak - day.equity) / peak;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }
  });

  return {
    strategy: strategyName,
    ticker: ticker,
    initialCapital,
    finalValue,
    roi: parseFloat(totalReturn.toFixed(2)),
    sharpeRatio: annualSharpe,
    maxDrawdown: parseFloat((maxDrawdown * 100).toFixed(2)),
    history: portfolioHistory,
    trades: tradesLog
  };
}

// ==========================================
// 2. RETAIL AI ASSISTANT NATURAL LANGUAGE PARSER
// ==========================================

async function parseAssistantQuery(query, cart = []) {
  const lower = query.toLowerCase().trim();
  let textResponse = '';
  let actions = [];
  const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const catalog = await Product.find({});
  const transactions = await Transaction.find({}).sort({ timestamp: -1 });

  // Greeting
  if (lower.match(/\b(hello|hi|hey|greet|good morning|good afternoon)\b/)) {
    textResponse = "Hello! I am the Enterprise Intelligence Retail Assistant. You can browse our product catalog, manage your cart, place orders, or query real-time DataMart KPI metrics. How can I help you today?";
    return { textResponse, actions };
  }

  // Catalog queries
  if (lower.match(/\b(catalog|products|items|available|sell|store|shop|buy)\b/) && !lower.match(/\b(buy|add)\b/)) {
    textResponse = "Here are the hot items currently available in our retail catalog. You can ask me to add any of them to your shopping cart:\n\n" + 
      catalog.map(p => `• **${p.name}** (${p.category}) - ${formatCurrency(p.price)} | Stock: ${p.inventory} left`).join('\n');
    actions.push({ type: 'SHOW_CATALOG' });
    return { textResponse, actions };
  }

  // KPI Queries
  if (lower.match(/\b(kpi|kpis|metrics|revenue|sales|total revenue|performance|chart|charts)\b/)) {
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.totalPrice, 0);
    const techSales = transactions.filter(t => t.category === 'Tech').reduce((sum, tx) => sum + tx.totalPrice, 0);
    const retailSales = transactions.filter(t => t.category === 'Retail').reduce((sum, tx) => sum + tx.totalPrice, 0);
    
    textResponse = `📊 **Real-time DataMart Financial Summary:**\n\n` + 
      `• **Total Platform Revenue:** ${formatCurrency(totalRevenue)}\n` +
      `• **Total Orders Processed:** ${transactions.length}\n` +
      `• **Tech Category Sales:** ${formatCurrency(techSales)}\n` +
      `• **Retail Category Sales:** ${formatCurrency(retailSales)}\n\n` +
      `Our trading signal reflects this volume. Would you like me to open the backtesting panel to check market returns?`;
    actions.push({ type: 'SHOW_KPIS', data: { totalRevenue, count: transactions.length } });
    return { textResponse, actions };
  }

  // Inventory / Stock Level Queries
  if (lower.match(/\b(inventory|stock|quantity|left|amount|reorder|supplier)\b/)) {
    const lowStock = catalog.filter(p => p.inventory < 15);
    let stockStatus = "Inventory Levels are stable.";
    if (lowStock.length > 0) {
      stockStatus = `⚠️ **Warning:** The following products are low on inventory:\n` +
        lowStock.map(p => `  • *${p.name}* is down to **${p.inventory}** units.`).join('\n');
    }
    textResponse = `📦 **Inventory Status:**\n\n` +
      catalog.map(p => `• **${p.name}**: ${p.inventory} units available`).join('\n') + `\n\n` + stockStatus;
    actions.push({ type: 'SHOW_INVENTORY' });
    return { textResponse, actions };
  }

  // Clear/Reset Cart
  if (lower.match(/\b(clear cart|empty cart|reset cart|remove all)\b/)) {
    textResponse = "I've emptied your shopping cart. Ready to start fresh!";
    actions.push({ type: 'CLEAR_CART' });
    return { textResponse, actions };
  }

  // Cart Status query
  if (lower.match(/\b(cart|shopping cart|my items|show cart|what is in my cart)\b/) && !lower.match(/\b(add|buy)\b/)) {
    if (cart.length === 0) {
      textResponse = "Your shopping cart is currently empty. Try asking: *'Add Quantum Laptop Pro to my cart'*";
    } else {
      const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      textResponse = `🛒 **Your Current Shopping Cart:**\n\n` +
        cart.map(item => `• **${item.product.name}** x ${item.quantity} - ${formatCurrency(item.product.price * item.quantity)}`).join('\n') +
        `\n\n**Subtotal:** ${formatCurrency(cartTotal)}\n\nWould you like me to checkout? (Type: *'checkout'*)`;
    }
    actions.push({ type: 'SHOW_CART' });
    return { textResponse, actions };
  }

  // Recommendations / gift / budget intent
  if (lower.match(/\b(recommend|suggest|gift|budget|under|below|cheap|best)\b/)) {
    const budgetMatch = lower.match(/(?:under|below)\s*[₹$]?\s*(\d+)/) || lower.match(/[₹$]\s*(\d+)/);
    const budget = budgetMatch ? parseFloat(budgetMatch[1]) : 150;

    let categoryHint = null;
    if (lower.match(/\b(tech|gadget|laptop|phone|headphones|developer|gamer)\b/)) {
      categoryHint = 'Tech';
    } else if (lower.match(/\b(office|retail|home|kitchen|shoes|bottle)\b/)) {
      categoryHint = 'Retail';
    }

    let pool = catalog.filter(p => p.inventory > 0 && p.price <= budget);
    if (categoryHint) {
      const categoryOnly = pool.filter(p => p.category === categoryHint);
      if (categoryOnly.length > 0) {
        pool = categoryOnly;
      }
    }

    const rankByValue = lower.match(/\b(cheap|budget|value)\b/);
    const rankByBest = lower.match(/\b(best|top|high rated|high-rated)\b/);

    const recommended = pool
      .sort((a, b) => {
        if (rankByValue && !rankByBest) {
          return a.price - b.price || b.rating - a.rating;
        }
        return b.rating - a.rating || a.price - b.price;
      })
      .slice(0, 3);

    if (recommended.length === 0) {
      textResponse = `I could not find products under ${formatCurrency(budget)} right now. Try increasing your budget or ask me to show the full catalog.`;
      actions.push({ type: 'SHOW_CATALOG' });
      return { textResponse, actions };
    }

    const qualifier = categoryHint ? ` in ${categoryHint}` : '';
    textResponse = `Great choice. Here are my recommendations${qualifier} under ${formatCurrency(budget)}:\n\n` +
      recommended
        .map((p, idx) => `${idx + 1}. **${p.name}** (${p.category}) - ${formatCurrency(p.price)} | Rating: ${p.rating}/5 | Stock: ${p.inventory}`)
        .join('\n') +
      `\n\nYou can say: *Add 1 ${recommended[0].name} to cart*.`;

    actions.push({ type: 'SHOW_CATALOG' });
    return { textResponse, actions };
  }

  // Place Order / Buy directly or Checkout
  if (lower.match(/\b(checkout|place order|buy cart|complete purchase|purchase)\b/) && !lower.match(/\b(buy \d+|add)\b/)) {
    if (cart.length === 0) {
      textResponse = "There is nothing in your cart to checkout. Try buying an item directly, e.g., *'Buy 2 AcousticANC Headphones'*";
    } else {
      actions.push({ type: 'CHECKOUT' });
      textResponse = "Initiating order checkout for your cart items. Processing...";
    }
    return { textResponse, actions };
  }

  const quantityMatch = lower.match(/\b(buy|add)\b\s+(\d+)\s+(.+)/) || lower.match(/\b(buy|add)\b\s+(.+)/);
  if (quantityMatch) {
    const verb = quantityMatch[1];
    let qty = 1;
    let prodQuery = '';

    if (quantityMatch.length === 4) {
      qty = parseInt(quantityMatch[2]);
      prodQuery = quantityMatch[3].replace(/to cart|my cart/g, '').trim();
    } else {
      prodQuery = quantityMatch[2].replace(/to cart|my cart/g, '').trim();
    }

    const matchedProduct = catalog.find(p => p.name.toLowerCase().includes(prodQuery) || prodQuery.includes(p.name.toLowerCase()));
    
    if (matchedProduct) {
      if (matchedProduct.inventory < qty) {
        textResponse = `Sorry, we only have **${matchedProduct.inventory}** units of **${matchedProduct.name}** remaining. I cannot fulfill a request for **${qty}** units.`;
      } else {
        if (verb === 'buy') {
          actions.push({
            type: 'DIRECT_PURCHASE',
            product: matchedProduct,
            quantity: qty
          });
          textResponse = `🎉 **Order Successful!** You bought **${qty}x ${matchedProduct.name}** for a total of **${formatCurrency(matchedProduct.price * qty)}**.\n\nTransactions are updated in the DataMart in real time! Go check the ledger, and see if it triggers buying signals in our backtesting charts.`;
        } else {
          actions.push({
            type: 'ADD_TO_CART',
            product: matchedProduct,
            quantity: qty
          });
          textResponse = `Added **${qty}x ${matchedProduct.name}** to your shopping cart. You now have this item staged. Type *'checkout'* to complete the purchase!`;
        }
      }
      return { textResponse, actions };
    }
  }

  textResponse = `I received: "${query}". I didn't quite catch the specific command.\n\n**Try saying:**\n` +
    `• *"Show catalog"* to view active inventory.\n` +
    `• *"Add 2 Quantum Laptop Pro to cart"* to stage an order.\n` +
    `• *"Checkout"* to purchase staged items.\n` +
    `• *"Buy 1 Barista Brewer Pro"* to place an order instantly.\n` +
    `• *"Show KPIs"* to view transactional volume in the DataMart.`;
  
  return { textResponse, actions };
}

// ==========================================
// 3. EXPRESS API ROUTING
// ==========================================

// Demo-only identity endpoints. Tokens are opaque and in-memory; no token,
// password, or API key is returned by the developer report.
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== DEMO_USER.username || password !== DEMO_USER.password) return res.status(401).json({ error: 'Invalid username or password' });
  const accessToken = crypto.randomUUID();
  const user = publicUser(DEMO_USER);
  authTokens.set(accessToken, user);
  res.json({ accessToken, user });
});

app.post('/api/refresh', (req, res) => {
  const accessToken = getAuthToken(req);
  const user = authTokens.get(accessToken);
  if (!user) return res.status(401).json({ error: 'Session expired.' });
  res.json({ accessToken, user });
});

app.post('/api/logout', (req, res) => {
  authTokens.delete(getAuthToken(req));
  res.status(204).end();
});

// Catalog API
app.get('/api/catalog', async (req, res) => {
  try {
    const catalog = await Product.find({});
    res.json(catalog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Transaction Ledger APIs
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find({}).sort({ timestamp: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Invalid product or quantity' });
    }

    const product = await Product.findOne({ id: productId });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.inventory < quantity) {
      return res.status(400).json({ error: 'Insufficient inventory' });
    }

    product.inventory -= quantity;
    await product.save();

    const totalPrice = parseFloat((product.price * quantity).toFixed(2));
    const newTx = new Transaction({
      id: `tx_${Math.random().toString(36).substring(2, 9)}`,
      productId: product.id,
      productName: product.name,
      category: product.category,
      quantity,
      price: product.price,
      totalPrice,
      timestamp: new Date()
    });

    await newTx.save();
    await simulatePriceImpact(product.category, quantity);

    res.status(201).json(newTx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk checkout API
app.post('/api/transactions/checkout', async (req, res) => {
  try {
    const { cartItems } = req.body;
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).json({ error: 'Empty cart cannot be checked out' });
    }

    for (const item of cartItems) {
      const prod = await Product.findOne({ id: item.product.id });
      if (!prod || prod.inventory < item.quantity) {
        return res.status(400).json({ error: `Insufficient inventory for product: ${prod ? prod.name : 'Unknown'}` });
      }
    }

    const createdTransactions = [];
    
    for (const item of cartItems) {
      const prod = await Product.findOne({ id: item.product.id });
      prod.inventory -= item.quantity;
      await prod.save();

      const totalPrice = parseFloat((prod.price * item.quantity).toFixed(2));
      const newTx = new Transaction({
        id: `tx_${Math.random().toString(36).substring(2, 9)}`,
        productId: prod.id,
        productName: prod.name,
        category: prod.category,
        quantity: item.quantity,
        price: prod.price,
        totalPrice,
        timestamp: new Date()
      });

      await newTx.save();
      createdTransactions.push(newTx);
      await simulatePriceImpact(prod.category, item.quantity);
    }

    res.status(201).json({ success: true, transactions: createdTransactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// KPIs API
app.get('/api/kpis', async (req, res) => {
  try {
    const transactions = await Transaction.find({});
    const stocksHistoricalData = await StockHistory.find({}).sort({ date: 1 });

    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.totalPrice, 0);
    const totalOrders = transactions.length;
    
    const techSales = transactions.filter(t => t.category === 'Tech').reduce((sum, tx) => sum + tx.totalPrice, 0);
    const retailSales = transactions.filter(t => t.category === 'Retail').reduce((sum, tx) => sum + tx.totalPrice, 0);

    const avgOrderValue = totalOrders > 0 ? parseFloat((totalRevenue / totalOrders).toFixed(2)) : 0;
    
    const lastIndex = stocksHistoricalData.length - 1;
    const currentTechStock = lastIndex >= 0 ? stocksHistoricalData[lastIndex].TECH : 150.00;
    const currentRetailStock = lastIndex >= 0 ? stocksHistoricalData[lastIndex].RETL : 80.00;

    res.json({
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalOrders,
      avgOrderValue,
      categorySales: {
        Tech: parseFloat(techSales.toFixed(2)),
        Retail: parseFloat(retailSales.toFixed(2))
      },
      currentStocks: {
        TECH: currentTechStock,
        RETL: currentRetailStock
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backtesting API
app.post('/api/backtest', async (req, res) => {
  try {
    const { strategyName, ticker, initialCapital } = req.body;
    if (!strategyName || !ticker) {
      return res.status(400).json({ error: 'Missing strategyName or ticker' });
    }

    const stocksHistoricalData = await StockHistory.find({}).sort({ date: 1 });
    const result = runBacktest(
      stocksHistoricalData,
      strategyName, 
      ticker, 
      initialCapital ? parseFloat(initialCapital) : 10000
    );

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stocks Historical API
app.get('/api/stocks', async (req, res) => {
  try {
    const stocksHistoricalData = await StockHistory.find({}).sort({ date: 1 });
    res.json(stocksHistoricalData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function compactAssistantResult(result) {
  return {
    type: result.type,
    message: result.message,
    products: (result.products || []).slice(0, 5).map((product) => ({
      id: product.id,
      name: product.name || product.productName,
      category: product.category,
      price: product.price,
      inventory: product.inventory,
      rating: product.rating,
      revenue: product.revenue,
      unitsSold: product.unitsSold,
    })),
    cartTotal: result.cartTotal,
    kpis: result.kpis,
    inventory: result.inventory,
    actionTypes: (result.actions || []).map((action) => action.type),
  };
}

async function askOllama(query, result) {
  if (!config.ollama.enabled) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ollama.timeoutMs);

  try {
    const response = await fetch(`${config.ollama.url.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.ollama.model,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              'You are a concise retail operations assistant inside an enterprise intelligence dashboard. ' +
              'Use only the supplied tool result as factual context. Do not invent product names, prices, inventory, KPIs, or actions. ' +
              'If the tool result includes cart or checkout actions, acknowledge them exactly as already decided. ' +
              'Keep the answer under 90 words and make it useful for a business user.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              userQuery: query,
              toolResult: compactAssistantResult(result),
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama responded with ${response.status}`);
    }

    const data = await response.json();
    return data?.message?.content?.trim() || null;
  } catch (error) {
    logger.warn({ err: error }, 'Ollama assistant enhancement unavailable; using rule engine response');
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function runRetailAssistant(query, cart = []) {
  const text = query.replace(/["']/g, '').trim().toLowerCase();
  // --------------------------------
// DATAMART / KPI INTENT
// --------------------------------

const kpiIntent =
  text.includes('total sales') ||
  text.includes('total revenue') ||
  text.includes('overall revenue') ||
  text.includes('how many transactions') ||
  text.includes('number of transactions') ||
  text.includes('transaction count') ||
  text.includes('average order value') ||
  text.includes('average order') ||
  text.includes('average purchase');

if (kpiIntent) {
  const kpis = await getSalesKPIs();

  return {
    type: 'datamart_kpi',
    message:
      `Total revenue is ${kpis.revenue.toFixed(2)}. ` +
      `There are ${kpis.transactions} transactions, ` +
      `${kpis.units} units sold, and the average ` +
      `transaction value is ${kpis.averageOrderValue.toFixed(2)}.`,
    kpis,
    products: [],
    actions: []
  };
}

const topProductIntent =
  text.includes('best selling') ||
  text.includes('best-selling') ||
  text.includes('top selling') ||
  text.includes('top product') ||
  text.includes('most popular');

if (topProductIntent) {
  const products = await getTopProducts(5);

  if (!products.length) {
    return {
      type: 'datamart_top_products',
      message: 'There is no sales data available.',
      products: [],
      actions: []
    };
  }

  const top = products[0];

  return {
    type: 'datamart_top_products',
    message:
      `${top.productName} is currently the top-selling ` +
      `product by revenue, generating ${top.revenue.toFixed(2)} ` +
      `from ${top.unitsSold} units sold.`,
    products,
    actions: []
  };
}

const categoryIntent =
  text.includes('best category') ||
  text.includes('top category') ||
  text.includes('category generates') ||
  text.includes('category revenue');

if (categoryIntent) {
  const categories =
    await getCategoryPerformance();

  if (!categories.length) {
    return {
      type: 'datamart_category',
      message: 'There is no category sales data available.',
      categories: [],
      actions: []
    };
  }

  const top = categories[0];

  return {
    type: 'datamart_category',
    message:
      `${top._id} is the highest-revenue category with ` +
      `${top.revenue.toFixed(2)} in revenue and ` +
      `${top.unitsSold} units sold.`,
    categories,
    actions: []
  };
}

  // --------------------------------
// CART STATUS
// --------------------------------

if (
  text.includes('what is in my cart') ||
  text.includes("what's in my cart") ||
  text.includes('show my cart') ||
  text.includes('view my cart') ||
  text.includes('cart summary')
) {
  if (!cart.length) {
    return {
      type: 'cart_status',
      message: 'Your cart is currently empty.',
      products: [],
      cart,
      actions: []
    };
  }

  const getCartItemName = (item) =>
  item.name ||
  item.productName ||
  item.product?.name ||
  'Unknown product';

const getCartItemPrice = (item) =>
  Number(
    item.price ??
    item.unitPrice ??
    item.product?.price ??
    0
  );

const getCartItemQuantity = (item) =>
  Number(
    item.quantity ??
    item.qty ??
    1
  );

const total = cart.reduce(
  (sum, item) =>
    sum +
    getCartItemPrice(item) *
    getCartItemQuantity(item),
  0
);

const itemSummary = cart
  .map((item) => {
    const name = getCartItemName(item);
    const quantity = getCartItemQuantity(item);

    return `${name} × ${quantity}`;
  })
  .join(', ');

  return {
    type: 'cart_status',
    message:
  `Your cart contains ${itemSummary}. ` +
  `The current total is ${total.toFixed(2)}.`,
    products: cart,
    cart,
    cartTotal: total,
    actions: []
  };
}
  // --------------------------------
// CART / SHOPPING INTENT
// --------------------------------

const quantityMatch = text.match(
  /\b(?:buy|add|purchase)\s+(\d+)\b/
);

const quantity = quantityMatch
  ? Math.max(1, Number(quantityMatch[1]))
  : 1;

const cartIntent =
  text.includes('add to cart') ||
  text.includes('add ') ||
  text.includes('buy ') ||
  text.includes('purchase ');

if (cartIntent) {
 const productQuery = text
  .replace(/\b(?:to my cart|into my cart|in my cart)\b/gi, '')
  .replace(/\b(?:please|i|want|to|my|the|add|buy|purchase)\b/gi, '')
  .replace(/\b(?:\d+)\b/gi, '')
  .replace(/\s+/g, ' ')
  .trim();

  const products = await searchProducts({
    query: productQuery,
    inStock: true,
    limit: 5
  });

  if (!products.length) {
    return {
      type: 'cart_action',
      message: `I couldn't find a product matching "${productQuery}".`,
      products: [],
      actions: []
    };
  }

  const product = products[0];

  if (product.inventory < quantity) {
    return {
      type: 'cart_action',
      message:
        `${product.name} only has ${product.inventory} ` +
        `unit${product.inventory === 1 ? '' : 's'} available.`,
      products: [product],
      actions: []
    };
  }

  return {
    type: 'cart_action',
    message:
      `Added ${quantity} ${product.name}` +
      `${quantity > 1 ? 's' : ''} to your cart.`,
    products: [product],
    actions: [
      {
        type: 'ADD_TO_CART',
        product,
        quantity
      }
    ]
  };
}

// --------------------------------
// CHECKOUT INTENT
// --------------------------------

if (
  text.includes('checkout') ||
  text.includes('check out')
) {
  return {
    type: 'cart_action',
    message: 'Proceeding to checkout.',
    products: [],
    actions: [
      {
        type: 'CHECKOUT'
      }
    ]
  };
}

// --------------------------------
// CLEAR CART INTENT
// --------------------------------

if (
  text.includes('clear my cart') ||
  text.includes('empty my cart') ||
  text.includes('remove everything from my cart')
) {
  return {
    type: 'cart_action',
    message: 'Your cart has been cleared.',
    products: [],
    actions: [
      {
        type: 'CLEAR_CART'
      }
    ]
  };
}
  // --------------------------------
  // PRODUCT SEARCH
  // --------------------------------

  const priceMatch = text.match(
    /(?:under|below|less than|max|within)\s*(?:₹|\$)?\s*([\d,]+)/
  );

  const maxPrice = priceMatch
    ? Number(priceMatch[1].replace(/,/g, ''))
    : undefined;

  let category;

  if (
    text.includes('laptop') ||
    text.includes('phone') ||
    text.includes('headphone') ||
    text.includes('tech')
  ) {
    category = 'Tech';
  }

  if (
    text.includes('shoe') ||
    text.includes('shoes') ||
    text.includes('retail')
  ) {
    category = 'Retail';
  }
  // --------------------------------
  // CATALOG INTENT
  // --------------------------------

  const catalogIntent =
    text.includes('catalog') ||
    text.includes('show all products') ||
    text.includes('list products') ||
    text.includes('browse products') ||
    text === 'show catalog' ||
    text === 'products';

  if (catalogIntent) {
    const products = await searchProducts({
      limit: 10
    });

    return {
      type: 'catalog',
      message: `Here is our full product catalog containing ${products.length} items.`,
      products,
      actions: [
        {
          type: 'SHOW_CATALOG'
        }
      ]
    };
  }

  // --------------------------------
  // INVENTORY INTENT
  // --------------------------------

const inventoryIntent =
  text.includes('in stock') ||
  text.includes('inventory') ||
  text.includes('available') ||
  text.includes('stock');

if (inventoryIntent) {
  const products = await searchProducts({
    query: text
      .replace(/is|are|the|in stock|inventory|available|stock|how many/gi, '')
      .trim(),
    inStock: false,
    limit: 5
  });

  if (!products.length) {
    return {
      type: 'inventory',
      message: 'I could not find that product.',
      products: [],
      actions: []
    };
  }

  const product = products[0];

  const inventory = await checkInventory(product.id);

  return {
    type: 'inventory',
    message: inventory.inStock
      ? `${inventory.name} is in stock with ${inventory.inventory} units available.`
      : `${inventory.name} is currently out of stock.`,
    products: [product],
    inventory,
    actions: [
      {
        type: 'show_inventory',
        productId: product.id
      }
    ]
  };
}

// --------------------------------
// PRODUCT DETAILS INTENT
// --------------------------------

const detailsIntent =
  text.includes('tell me about') ||
  text.includes('details') ||
  text.includes('information about') ||
  text.includes('what is the price') ||
  text.includes('how much is');

if (detailsIntent) {
  const products = await searchProducts({
    query: text
      .replace(
        /tell me about|details|information about|what is the price|how much is/gi,
        ''
      )
      .trim(),
    limit: 5
  });

  if (!products.length) {
    return {
      type: 'product_details',
      message: 'I could not find that product.',
      products: [],
      actions: []
    };
  }

  const product = await getProductDetails(products[0].id);

  return {
    type: 'product_details',
    message:
      `${product.name} costs ${product.price}. ` +
      `It has a ${product.rating}/5 rating and ` +
      `${product.inventory} units currently in stock.`,
    products: [product],
    actions: [
      {
        type: 'show_product_details',
        productId: product.id
      }
    ]
  };
}
  // Recommendation intent
  const recommendationIntent =
    text.includes('recommend') ||
    text.includes('suggest') ||
    text.includes('best') ||
    text.includes('which should');

  if (recommendationIntent) {
    const products = await recommendProducts({
      category,
      maxPrice,
      minRating: 4,
      limit: 5
    });

    return {
      type: 'recommendations',
      message: products.length
        ? `I found ${products.length} products that match your requirements.`
        : 'I could not find products matching those requirements.',
      products,
      actions: [
        {
          type: 'show_recommendations',
          count: products.length
        }
      ]
    };
  }

  // Normal search
  const products = await searchProducts({
    query:
      category ||
      text
        .replace(/under.*$/i, '')
        .replace(/below.*$/i, '')
        .trim(),

    category,
    maxPrice,
    inStock: false,
    limit: 10
  });

  return {
    type: 'product_search',
    message: products.length
      ? `I found ${products.length} products matching your request.`
      : 'I could not find any products matching your request.',
    products,
    actions: [
      {
        type: 'show_products',
        count: products.length
      }
    ]
  };
}

// Chatbot Parser API
app.post('/api/assistant', async (req, res) => {
  try {
    const {
      query,
      cart = [],
      sessionId = 'default-session'
    } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({
        error: 'Query is required'
      });
    }

    const result = await runRetailAssistant(query, cart);
    const aiMessage = await askOllama(query, result);
    const llmEnabled = Boolean(aiMessage);

    assistantMetrics.totalRequests += 1;
    assistantMetrics.ruleEngineResponses += 1;
    assistantMetrics.actionCalls += result.actions?.length || 0;
    assistantMetrics.lastRequestAt = new Date().toISOString();

    assistantSessions.set(sessionId, Date.now());

    res.json({
      ...result,
      message: aiMessage || result.message,
      textResponse: aiMessage || result.message,

      meta: {
        mode: llmEnabled ? 'llm' : 'local_tool_engine',
        llmEnabled,
        llmProvider: llmEnabled ? 'ollama' : null,
        model: llmEnabled ? config.ollama.model : null,
        toolsUsed: [getAssistantTool(result.type)]
      }
    });

  } catch (err) {
    console.error('Retail assistant error:', err);

    res.status(500).json({
      error: 'Retail assistant failed',
      message: err.message
    });
  }
});
app.get('/api/assistant/health', (_req, res) => {
  res.json({
    status: 'Healthy',
    mode: process.env.OPENAI_API_KEY ? 'rule_engine_with_ai_key_configured' : 'rule_engine',
    model: process.env.OPENAI_MODEL || 'Local Tool Engine',
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    guardrailLimit: `${config.rateLimit.max} requests / ${Math.round(config.rateLimit.windowMs / 60000)} minute`,
    activeSessions: assistantSessions.size,
    metrics: assistantMetrics
  });
});

app.get('/api/developer-report', requireAdmin, async (_req, res, next) => {
  try {
    const dbConnected = mongoose.connection.readyState === 1;

    const services = await Promise.all([
      probeService(
        'Core API',
        '/health',
        async () => {
          if (!dbConnected) {
            throw new Error('MongoDB unavailable');
          }

          return 'Express API and MongoDB ready';
        }
      ),

      probeService(
        'Retail',
        '/api/catalog',
        async () => {
          const count = await Product.countDocuments();
          return `${count} products available`;
        }
      ),

      probeService(
        'DataMart',
        '/api/transactions',
        async () => {
          const count = await Transaction.countDocuments();

          if (count === 0) {
            throw new Error('No transaction data');
          }

          return `${count} transaction records`;
        }
      ),

      probeService(
        'Backtesting',
        '/api/stocks',
        async () => {
          const count = await StockHistory.countDocuments();

          if (count < 5) {
            throw new Error('Insufficient market data');
          }

          return `${count} market rows`;
        }
      ),

      probeService(
        'AI Assistant',
        '/api/assistant/health',
        async () => {
          const count = await Product.countDocuments();

          if (count === 0) {
            throw new Error('Product catalog unavailable');
          }

          return 'Assistant dependencies available';
        }
      ),
    ]);

    const [
      products,
      transactions,
      stocks,
      duplicateTransactions,
      duplicateStocks,
    ] = await Promise.all([
      Product.find(
        {},
        { id: 1, inventory: 1 }
      ).lean(),

      Transaction.find(
        {},
        {
          id: 1,
          productId: 1,
          productName: 1,
          category: 1,
          quantity: 1,
          price: 1,
          totalPrice: 1,
          timestamp: 1,
        }
      ).lean(),

      StockHistory.find(
        {},
        {
          date: 1,
          TECH: 1,
          RETL: 1,
          techVolume: 1,
          retailVolume: 1,
        }
      ).lean(),

      Transaction.aggregate([
        {
          $group: {
            _id: '$id',
            count: { $sum: 1 },
          },
        },
        {
          $match: {
            count: { $gt: 1 },
          },
        },
        {
          $count: 'count',
        },
      ]),

      StockHistory.aggregate([
        {
          $group: {
            _id: '$date',
            count: { $sum: 1 },
          },
        },
        {
          $match: {
            count: { $gt: 1 },
          },
        },
        {
          $count: 'count',
        },
      ]),
    ]);

    const requiredTransactionFields = [
      'id',
      'productId',
      'productName',
      'category',
      'quantity',
      'price',
      'totalPrice',
      'timestamp',
    ];

    const invalidTransactions = transactions.filter((row) => {
      const missingField = requiredTransactionFields.some(
        (field) =>
          row[field] === undefined ||
          row[field] === null
      );

      return (
        missingField ||
        !Number.isFinite(row.quantity) ||
        !Number.isFinite(row.price) ||
        !Number.isFinite(row.totalPrice) ||
        Number.isNaN(Date.parse(row.timestamp))
      );
    }).length;

    const invalidStocks = stocks.filter((row) => {
      return (
        !row.date ||
        !Number.isFinite(row.TECH) ||
        !Number.isFinite(row.RETL) ||
        !Number.isFinite(row.techVolume) ||
        !Number.isFinite(row.retailVolume)
      );
    }).length;

    const duplicateRecords =
      (duplicateTransactions[0]?.count || 0) +
      (duplicateStocks[0]?.count || 0);

    const lowStockProducts = products.filter(
      (product) => product.inventory < 15
    ).length;

    const servicesHealthy = services.filter(
      (service) => service.status === 'Healthy'
    ).length;

    const dataQualityStatus =
      invalidTransactions === 0 &&
      invalidStocks === 0 &&
      duplicateRecords === 0
        ? 'healthy'
        : 'attention_required';

    const modules = [
      {
        name: 'AI Retail Assistant',
        status: services[4].status,
        detail: assistantSessions.size
          ? `${assistantSessions.size} active session(s)`
          : 'No active sessions',
      },
      {
        name: 'DataMart',
        status: services[2].status,
        detail: `${transactions.length} transaction records`,
      },
      {
        name: 'Backtesting',
        status: services[3].status,
        detail: `${stocks.length} historical price records`,
      },
      {
        name: 'Product / Inventory',
        status: services[1].status,
        detail: `${products.length} products, ${lowStockProducts} low stock`,
      },
    ];

    const criticalFailure =
      !dbConnected ||
      servicesHealthy === 0;

    const hasWarnings =
      dataQualityStatus !== 'healthy' ||
      modules.some(
        (module) => module.status === 'Degraded'
      );

    let readiness = 'READY';

    if (criticalFailure) {
      readiness = 'NOT READY';
    } else if (
      servicesHealthy < services.length ||
      hasWarnings
    ) {
      readiness = 'READY WITH WARNINGS';
    }

    res.json({
      generatedAt: new Date().toISOString(),

      apiHealth: {
        status:
          servicesHealthy === services.length
            ? 'Healthy'
            : servicesHealthy > 0
              ? 'Degraded'
              : 'Down',

        reachable: servicesHealthy,
        total: services.length,
      },

      services,

      modules,

      assistant: {
        mode: config.ollama.enabled
          ? 'rule_engine_with_ollama'
          : 'rule_engine',

        model:
          process.env.OPENAI_MODEL ||
          'Local Tool Engine',

        apiKeyConfigured:
          false,

        ollamaEnabled:
          config.ollama.enabled,

        ollamaUrl:
          config.ollama.url,

        guardrailLimit:
          `${config.rateLimit.max} requests / ${Math.round(
            config.rateLimit.windowMs / 60000
          )} minute`,

        activeSessions:
          assistantSessions.size,
      },

      dataQuality: {
        status: dataQualityStatus,

        catalogProducts:
          products.length,

        transactionRows:
          transactions.length,

        stockHistoryRows:
          stocks.length,

        invalidTransactionRows:
          invalidTransactions,

        invalidStockRows:
          invalidStocks,

        duplicateRecords,

        lowStockProducts,
      },

      storage: {
        mode: 'MongoDB',

        status: dbConnected
          ? 'Connected'
          : 'Disconnected',

        persistent: true,
      },

      configuration: {
        authentication:
          'Demo bearer-token authentication',

        persistence:
          'MongoDB',

        apiVersion:
          'unversioned',
      },

      deliveryReadiness: {
        status: readiness,

        reason:
          readiness === 'READY'
            ? 'All required services and data checks are healthy.'
            : readiness === 'READY WITH WARNINGS'
              ? 'Core services are available, but some optional or data-quality checks need attention.'
              : 'Critical backend dependencies are unavailable.',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Reset Sandbox API
app.post('/api/reset', async (req, res) => {
  try {
    await resetDatabase();
    res.json({ success: true, message: 'Sandbox MongoDB data reset successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  logger.info(`🚀 Enterprise Intelligence Platform backend running at http://localhost:${PORT}`);
});
