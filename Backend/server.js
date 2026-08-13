import express from 'express';
import cors from 'cors';

<<<<<<< HEAD
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
=======
// --- Production/scalability hardening imports ---
import { config } from './config/env.js';
import { logger, httpLogger } from './config/logger.js';
import { errorHandler, notFoundHandler, registerProcessSafetyNets } from './middleware/errorHandler.js';
import { generalLimiter, strictLimiter } from './middleware/rateLimiter.js';
import { validate, schemas } from './middleware/validate.js';
import { healthRouter } from './routes/health.js';
import { metricsCollector, metricsRouter } from './routes/metrics.js';

registerProcessSafetyNets(logger);

const app = express();
const PORT = config.port;

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(httpLogger); // structured request logging, adds req.id + req.log
app.use(metricsCollector); // prometheus request metrics (count, duration, errors)
app.use(healthRouter); // /health and /ready - unauthenticated, unrate-limited on purpose
app.use(metricsRouter); // /metrics - prometheus scrape endpoint (unauthenticated on purpose)
// --- Auth middleware should slot in HERE once the auth teammate lands it ---
app.use('/api', generalLimiter); // baseline rate limit for all API routes
>>>>>>> kairavi

// ==========================================
// 1. IN-MEMORY DATABASE & CONFIG
// ==========================================

const INITIAL_CATALOG = [
  { id: 'prod_1', name: 'Quantum Laptop Pro', category: 'Tech', price: 1499.99, inventory: 45, rating: 4.8 },
  { id: 'prod_2', name: 'Titanium Smartphone 15', category: 'Tech', price: 999.99, inventory: 60, rating: 4.7 },
  { id: 'prod_3', name: 'AcousticANC Headphones', category: 'Tech', price: 299.99, inventory: 80, rating: 4.5 },
  { id: 'prod_4', name: 'Apex Running Shoes', category: 'Retail', price: 129.99, inventory: 120, rating: 4.4 },
  { id: 'prod_5', name: 'Barista Brewer Pro', category: 'Retail', price: 199.99, inventory: 35, rating: 4.6 },
  { id: 'prod_6', name: 'HydroSport Smart Bottle', category: 'Retail', price: 49.99, inventory: 150, rating: 4.2 }
];

let catalog = JSON.parse(JSON.stringify(INITIAL_CATALOG));
let transactions = [];
let stocksHistoricalData = [];

<<<<<<< HEAD
// Assistant runtime state (in-memory sandbox)
const assistantSessions = new Map();
const assistantRateLimit = new Map();
const assistantMetrics = {
  totalRequests: 0,
  blockedRequests: 0,
  ruleEngineResponses: 0,
  llmResponses: 0,
  actionCalls: 0,
  lastRequestAt: null
};

=======
>>>>>>> kairavi
// ==========================================
// 2. STOCK & TRANSACTION DATA GENERATOR (SEED)
// ==========================================

// Seed transactions and stock data for the last 30 days
function generateSeedData() {
  const data = [];
  const seedTransactions = [];
  const now = new Date();
  
  // Base prices for simulated stock tickers
  // TECH (correlates with Tech sales)
  // RETL (correlates with Retail sales)
  let techPrice = 150.00;
  let retlPrice = 80.00;

  // Let's generate 30 days of data, 1 data point per day
  for (let i = 30; i >= 0; i--) {
    const currentDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = currentDate.toISOString().split('T')[0];

    // Seed transaction activity on this day (simulate 1 to 4 transactions daily)
    const txCount = Math.floor(Math.random() * 3) + 1; // 1 to 3 transactions
    let techVolumeToday = 0;
    let retailVolumeToday = 0;

    for (let t = 0; t < txCount; t++) {
      // Pick a random product
      const product = INITIAL_CATALOG[Math.floor(Math.random() * INITIAL_CATALOG.length)];
      const qty = Math.floor(Math.random() * 3) + 1; // 1 to 3 items
      const totalPrice = parseFloat((product.price * qty).toFixed(2));
      const txTime = new Date(currentDate.getTime() + Math.floor(Math.random() * 8 * 60 * 60 * 1000)); // offset hours

      seedTransactions.push({
        id: `tx_${Math.random().toString(36).substring(2, 9)}`,
        productId: product.id,
        productName: product.name,
        category: product.category,
        quantity: qty,
        price: product.price,
        totalPrice: totalPrice,
        timestamp: txTime.toISOString()
      });

      if (product.category === 'Tech') {
        techVolumeToday += qty;
      } else {
        retailVolumeToday += qty;
      }
    }

    // Simulate stock price changes based on transaction activity
    // Higher transaction volume today leads to positive pressure on stock price tomorrow
    const techGrowth = (techVolumeToday - 2) * 0.4 + (Math.random() - 0.48) * 2; // normal noise + momentum
    const retlGrowth = (retailVolumeToday - 2) * 0.2 + (Math.random() - 0.49) * 1.2;

    techPrice = parseFloat((techPrice + techGrowth).toFixed(2));
    retlPrice = parseFloat((retlPrice + retlGrowth).toFixed(2));

    if (techPrice < 10) techPrice = 10;
    if (retlPrice < 10) retlPrice = 10;

    data.push({
      date: dateStr,
      TECH: techPrice,
      RETL: retlPrice,
      techVolume: techVolumeToday,
      retailVolume: retailVolumeToday
    });
  }

  // Sort transactions chronologically
  seedTransactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  transactions = seedTransactions;
  stocksHistoricalData = data;
}

// Initialize seed data
generateSeedData();

// Helper: Simulate stock price update after placing an order
function simulatePriceImpact(category, quantity) {
  const lastIndex = stocksHistoricalData.length - 1;
  if (lastIndex >= 0) {
    const impactFactor = category === 'Tech' ? 0.8 : 0.4;
    const impact = quantity * impactFactor;
    stocksHistoricalData[lastIndex][category === 'Tech' ? 'TECH' : 'RETL'] = parseFloat(
      (stocksHistoricalData[lastIndex][category === 'Tech' ? 'TECH' : 'RETL'] + impact).toFixed(2)
    );
  }
}

<<<<<<< HEAD
function getKpiSnapshot() {
  const totalRevenue = transactions.reduce((sum, tx) => sum + tx.totalPrice, 0);
  const totalOrders = transactions.length;
  const techSales = transactions
    .filter(t => t.category === 'Tech')
    .reduce((sum, tx) => sum + tx.totalPrice, 0);
  const retailSales = transactions
    .filter(t => t.category === 'Retail')
    .reduce((sum, tx) => sum + tx.totalPrice, 0);
  const avgOrderValue = totalOrders > 0 ? parseFloat((totalRevenue / totalOrders).toFixed(2)) : 0;

  return {
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalOrders,
    avgOrderValue,
    techSales: parseFloat(techSales.toFixed(2)),
    retailSales: parseFloat(retailSales.toFixed(2))
  };
}

function enforceAssistantRateLimit(sessionId) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequestsPerWindow = 20;
  const bucket = assistantRateLimit.get(sessionId) || [];
  const active = bucket.filter(ts => now - ts < windowMs);

  if (active.length >= maxRequestsPerWindow) {
    return false;
  }

  active.push(now);
  assistantRateLimit.set(sessionId, active);
  return true;
}

function validateAssistantInput(query) {
  const sanitized = String(query || '').trim();
  if (!sanitized) {
    return { valid: false, reason: 'Please enter a query.' };
  }

  if (sanitized.length > 600) {
    return { valid: false, reason: 'Query is too long. Please keep it under 600 characters.' };
  }

  const blockedPatterns = [
    /ignore\s+all\s+previous\s+instructions/i,
    /reveal\s+system\s+prompt/i,
    /execute\s+arbitrary\s+code/i,
    /drop\s+table/i
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(sanitized)) {
      return { valid: false, reason: 'This request was blocked by assistant safety guardrails.' };
    }
  }

  return { valid: true, sanitized };
}

function getSessionHistory(sessionId) {
  if (!assistantSessions.has(sessionId)) {
    assistantSessions.set(sessionId, []);
  }
  return assistantSessions.get(sessionId);
}

function appendSessionHistory(sessionId, role, content) {
  const history = getSessionHistory(sessionId);
  history.push({ role, content, at: new Date().toISOString() });
  if (history.length > 10) {
    history.splice(0, history.length - 10);
  }
}

function buildRecommendations(cart = [], query = '') {
  const lowerQuery = String(query || '').toLowerCase();
  const cartIds = new Set(cart.map(item => item.product?.id));
  const lowStock = catalog.filter(p => p.inventory < 20);

  const catalogSortedByRating = [...catalog].sort((a, b) => b.rating - a.rating);
  const bestRatedNotInCart = catalogSortedByRating.find(p => !cartIds.has(p.id));

  const topSellerCounts = transactions.reduce((acc, tx) => {
    acc[tx.productId] = (acc[tx.productId] || 0) + tx.quantity;
    return acc;
  }, {});

  const topProductId = Object.keys(topSellerCounts).sort((a, b) => topSellerCounts[b] - topSellerCounts[a])[0];
  const topProduct = topProductId ? catalog.find(p => p.id === topProductId) : null;
  const lowStockPriority = lowStock.find(p => !cartIds.has(p.id));

  const picks = [];

  if (bestRatedNotInCart) {
    picks.push({
      id: bestRatedNotInCart.id,
      name: bestRatedNotInCart.name,
      reason: `Highly rated (${bestRatedNotInCart.rating}/5) and frequently recommended for first-time buyers.`,
      price: bestRatedNotInCart.price,
      category: bestRatedNotInCart.category
    });
  }

  if (topProduct && !cartIds.has(topProduct.id)) {
    picks.push({
      id: topProduct.id,
      name: topProduct.name,
      reason: `Trending demand signal from transaction flow (${topSellerCounts[topProduct.id]} units sold).`,
      price: topProduct.price,
      category: topProduct.category
    });
  }

  if (lowStockPriority) {
    picks.push({
      id: lowStockPriority.id,
      name: lowStockPriority.name,
      reason: `Inventory is tightening (${lowStockPriority.inventory} units left), useful for urgency-driven promotions.`,
      price: lowStockPriority.price,
      category: lowStockPriority.category
    });
  }

  if (lowerQuery.includes('gift') || lowerQuery.includes('budget')) {
    const affordable = catalog.find(p => p.price < 100 && !cartIds.has(p.id));
    if (affordable) {
      picks.unshift({
        id: affordable.id,
        name: affordable.name,
        reason: 'Budget-friendly option selected from your query intent.',
        price: affordable.price,
        category: affordable.category
      });
    }
  }

  return picks.slice(0, 3);
}

async function tryLLMAssistantResponse(query, cart = [], sessionId = 'default-session') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const context = {
    catalog: catalog.map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price, inventory: p.inventory, rating: p.rating })),
    kpis: getKpiSnapshot(),
    recentTransactions: transactions.slice(0, 8),
    cart: cart.map(item => ({ id: item.product?.id, name: item.product?.name, quantity: item.quantity, price: item.product?.price })),
    sessionHistory: getSessionHistory(sessionId).slice(-6)
  };

  const systemPrompt = [
    'You are an enterprise retail assistant inside a sandbox platform.',
    'Return only JSON with shape: {"textResponse": string, "actions": array}.',
    'Allowed actions: ADD_TO_CART, DIRECT_PURCHASE, CHECKOUT, CLEAR_CART, SHOW_KPIS, SHOW_CATALOG, SHOW_CART, SHOW_INVENTORY.',
    'When using ADD_TO_CART or DIRECT_PURCHASE include fields: product {id,name,price,category,inventory}, quantity.',
    'Never fabricate products. Use only provided context.'
  ].join(' ');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Context: ${JSON.stringify(context)}\n\nUser query: ${query}`
          }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content);
    if (!parsed.textResponse || !Array.isArray(parsed.actions)) {
      return null;
    }

    return {
      textResponse: parsed.textResponse,
      actions: parsed.actions
    };
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

=======
>>>>>>> kairavi
// ==========================================
// 3. BACKTESTER ENGINE (LOOK-AHEAD BIAS-FREE)
// ==========================================

/**
 * Runs a backtest simulation on historical stock prices.
 * It iterates day-by-day and feeds the strategy function only data available up to that day.
 * 
 * @param {string} strategyName - 'transactionMomentum' or 'smaCrossover'
 * @param {string} ticker - 'TECH' or 'RETL'
 * @param {number} initialCapital - Starting portfolio cash (USD)
 */
function runBacktest(strategyName, ticker, initialCapital = 10000) {
  let cash = initialCapital;
  let shares = 0;
  let portfolioHistory = [];
  let tradesLog = [];

  const days = stocksHistoricalData.length;
  if (days < 5) return { error: 'Insufficient data for backtest' };

  // Iterate day by day. This prevents look-ahead bias as we execute trade calculations
  // utilizing strictly slice(0, t + 1) for indicators and signals.
  for (let t = 0; t < days; t++) {
    const currentDayData = stocksHistoricalData[t];
    const currentDate = currentDayData.date;
    const price = currentDayData[ticker];

    // Create the isolated historical window up to the current day (index t)
    const historicalSlice = stocksHistoricalData.slice(0, t + 1);
    const sliceCount = historicalSlice.length;

    // Get signals based on the strategy
    let signal = 'HOLD'; // default

    if (strategyName === 'transactionMomentum') {
      // STRATEGY: Retail Volume Momentum
      // Buy if the transaction volume momentum (measured in product orders) shows positive growth.
      // Compare 3-day average volume against 10-day average volume.
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
      // STRATEGY: Simple Technical Indicator (SMA 5 / SMA 15 Crossover)
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

        // Crossover logic
        // If short-term average is above long-term, buy (upward price momentum)
        if (sma5 > sma15) {
          signal = 'BUY';
        } else if (sma5 < sma15) {
          signal = 'SELL';
        }
      }
    }

    // Execute trades at today's close price
    if (signal === 'BUY' && cash > 0) {
      // Buy max shares with available cash
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
      // Sell all shares
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

    // Calculate end of day portfolio value
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

  // Calculate Performance Metrics
  const finalValue = portfolioHistory[portfolioHistory.length - 1].equity;
  const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;
  
  // Calculate Sharpe Ratio (using daily returns, simplified)
  let dailyReturns = [];
  for (let i = 1; i < portfolioHistory.length; i++) {
    const prev = portfolioHistory[i - 1].equity;
    const curr = portfolioHistory[i].equity;
    dailyReturns.push((curr - prev) / prev);
  }
  
  const avgDailyReturn = dailyReturns.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, val) => sum + Math.pow(val - avgDailyReturn, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);
  
  // Sharpe Ratio (assuming risk-free rate of 0 for simplicity, annualized assuming 252 trading days)
  const annualSharpe = stdDev > 0 ? parseFloat(((avgDailyReturn / stdDev) * Math.sqrt(252)).toFixed(2)) : 0;

  // Max Drawdown calculation
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
// 4. RETAIL AI ASSISTANT NATURAL LANGUAGE PARSER
// ==========================================

function parseAssistantQuery(query, cart = []) {
  const lower = query.toLowerCase().trim();
  let textResponse = '';
  let actions = [];

  // Greeting
  if (lower.match(/\b(hello|hi|hey|greet|good morning|good afternoon)\b/)) {
    textResponse = "Hello! I am the Enterprise Intelligence Retail Assistant. You can browse our product catalog, manage your cart, place orders, or query real-time DataMart KPI metrics. How can I help you today?";
    return { textResponse, actions };
  }

  // Catalog queries
  if (lower.match(/\b(catalog|products|items|available|sell|store|shop|buy)\b/) && !lower.match(/\b(buy|add)\b/)) {
    textResponse = "Here are the hot items currently available in our retail catalog. You can ask me to add any of them to your shopping cart:\n\n" + 
      catalog.map(p => `• **${p.name}** (${p.category}) - $${p.price} | Stock: ${p.inventory} left`).join('\n');
    actions.push({ type: 'SHOW_CATALOG' });
    return { textResponse, actions };
  }

  // KPI Queries
  if (lower.match(/\b(kpi|kpis|metrics|revenue|sales|total revenue|performance|chart|charts)\b/)) {
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.totalPrice, 0);
    const techSales = transactions.filter(t => t.category === 'Tech').reduce((sum, tx) => sum + tx.totalPrice, 0);
    const retailSales = transactions.filter(t => t.category === 'Retail').reduce((sum, tx) => sum + tx.totalPrice, 0);
    
    textResponse = `📊 **Real-time DataMart Financial Summary:**\n\n` + 
      `• **Total Platform Revenue:** $${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n` +
      `• **Total Orders Processed:** ${transactions.length}\n` +
      `• **Tech Category Sales:** $${techSales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n` +
      `• **Retail Category Sales:** $${retailSales.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n\n` +
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

<<<<<<< HEAD
  // Cart Status query (exclude explicit add/buy intents)
  if (
    lower.match(/\b(cart|shopping cart|my items|show cart|what is in my cart)\b/) &&
    !lower.match(/\b(add|buy)\b/)
  ) {
=======
  // Cart Status query
  if (lower.match(/\b(cart|shopping cart|my items|show cart|what is in my cart)\b/)) {
>>>>>>> kairavi
    if (cart.length === 0) {
      textResponse = "Your shopping cart is currently empty. Try asking: *'Add Quantum Laptop Pro to my cart'*";
    } else {
      const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      textResponse = `🛒 **Your Current Shopping Cart:**\n\n` +
        cart.map(item => `• **${item.product.name}** x ${item.quantity} - $${(item.product.price * item.quantity).toFixed(2)}`).join('\n') +
        `\n\n**Subtotal:** $${cartTotal.toFixed(2)}\n\nWould you like me to checkout? (Type: *'checkout'*)`;
    }
    actions.push({ type: 'SHOW_CART' });
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

  // Match: Buy [Qty] [Product Name] or Add [Qty] [Product Name] to cart
  // Examples: "Buy 2 Laptop", "Add Quantum Laptop Pro to cart", "Buy 1 Apex Running Shoes"
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

    // Try finding product in catalog by fuzzy name match
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
          textResponse = `🎉 **Order Successful!** You bought **${qty}x ${matchedProduct.name}** for a total of **$${(matchedProduct.price * qty).toFixed(2)}**.\n\nTransactions are updated in the DataMart in real time! Go check the ledger, and see if it triggers buying signals in our backtesting charts.`;
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

<<<<<<< HEAD
  // Recommendations / gift / budget intent
  if (lower.match(/\b(recommend|suggest|gift|budget|under|below|cheap|best)\b/)) {
    const budgetMatch = lower.match(/(?:under|below)\s*\$?\s*(\d+)/) || lower.match(/\$\s*(\d+)/);
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
      textResponse = `I could not find products under $${budget.toFixed(0)} right now. Try increasing your budget or ask me to show the full catalog.`;
      actions.push({ type: 'SHOW_CATALOG' });
      return { textResponse, actions };
    }

    const qualifier = categoryHint ? ` in ${categoryHint}` : '';
    textResponse = `Great choice. Here are my recommendations${qualifier} under $${budget.toFixed(0)}:\n\n` +
      recommended
        .map((p, idx) => `${idx + 1}. **${p.name}** (${p.category}) - $${p.price.toFixed(2)} | Rating: ${p.rating}/5 | Stock: ${p.inventory}`)
        .join('\n') +
      `\n\nYou can say: *Add 1 ${recommended[0].name} to cart*.`;

    actions.push({ type: 'SHOW_CATALOG' });
    return { textResponse, actions };
  }

=======
>>>>>>> kairavi
  // Fallback to General AI / Help
  textResponse = `I received: "${query}". I didn't quite catch the specific command.\n\n**Try saying:**\n` +
    `• *"Show catalog"* to view active inventory.\n` +
    `• *"Add 2 Quantum Laptop Pro to cart"* to stage an order.\n` +
    `• *"Checkout"* to purchase staged items.\n` +
    `• *"Buy 1 Barista Brewer Pro"* to place an order instantly.\n` +
    `• *"Show KPIs"* to view transactional volume in the DataMart.`;
  
  return { textResponse, actions };
}

// ==========================================
// 5. EXPRESS API ROUTING
// ==========================================

// Catalog API
app.get('/api/catalog', (req, res) => {
  res.json(catalog);
});

// Transaction Ledger APIs
app.get('/api/transactions', (req, res) => {
  res.json(transactions);
});

<<<<<<< HEAD
app.post('/api/transactions', (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Invalid product or quantity' });
  }
=======
app.post('/api/transactions', validate(schemas.createTransaction), (req, res) => {
  const { productId, quantity } = req.body;
>>>>>>> kairavi

  const product = catalog.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  if (product.inventory < quantity) {
    return res.status(400).json({ error: 'Insufficient inventory' });
  }

  // Deduct inventory
  product.inventory -= quantity;

  // Create Transaction
  const totalPrice = parseFloat((product.price * quantity).toFixed(2));
  const newTx = {
    id: `tx_${Math.random().toString(36).substring(2, 9)}`,
    productId: product.id,
    productName: product.name,
    category: product.category,
    quantity,
    price: product.price,
    totalPrice,
    timestamp: new Date().toISOString()
  };

  transactions.unshift(newTx); // Add to front of ledger

  // Simulate price impact on ticker index
  simulatePriceImpact(product.category, quantity);

  res.status(201).json(newTx);
});

// Bulk checkout API
<<<<<<< HEAD
app.post('/api/transactions/checkout', (req, res) => {
  const { cartItems } = req.body; // Array of { product: {id, ...}, quantity: N }
  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ error: 'Empty cart cannot be checked out' });
  }
=======
app.post('/api/transactions/checkout', strictLimiter, validate(schemas.checkout), (req, res) => {
  const { cartItems } = req.body; // Array of { product: {id, ...}, quantity: N }
>>>>>>> kairavi

  // Validate all items
  for (const item of cartItems) {
    const prod = catalog.find(p => p.id === item.product.id);
    if (!prod || prod.inventory < item.quantity) {
      return res.status(400).json({ error: `Insufficient inventory for product: ${prod ? prod.name : 'Unknown'}` });
    }
  }

  const createdTransactions = [];
  
  // Process inventory deduction & transactions
  for (const item of cartItems) {
    const prod = catalog.find(p => p.id === item.product.id);
    prod.inventory -= item.quantity;

    const totalPrice = parseFloat((prod.price * item.quantity).toFixed(2));
    const newTx = {
      id: `tx_${Math.random().toString(36).substring(2, 9)}`,
      productId: prod.id,
      productName: prod.name,
      category: prod.category,
      quantity: item.quantity,
      price: prod.price,
      totalPrice,
      timestamp: new Date().toISOString()
    };

    transactions.unshift(newTx);
    createdTransactions.push(newTx);
    
    // Simulate price impact on stocks
    simulatePriceImpact(prod.category, item.quantity);
  }

  res.status(201).json({ success: true, transactions: createdTransactions });
});

// KPIs API
app.get('/api/kpis', (req, res) => {
<<<<<<< HEAD
  const kpis = getKpiSnapshot();
=======
  const totalRevenue = transactions.reduce((sum, tx) => sum + tx.totalPrice, 0);
  const totalOrders = transactions.length;
  
  const techSales = transactions.filter(t => t.category === 'Tech').reduce((sum, tx) => sum + tx.totalPrice, 0);
  const retailSales = transactions.filter(t => t.category === 'Retail').reduce((sum, tx) => sum + tx.totalPrice, 0);

  const avgOrderValue = totalOrders > 0 ? parseFloat((totalRevenue / totalOrders).toFixed(2)) : 0;
>>>>>>> kairavi
  
  // Tickers list with current values
  const lastIndex = stocksHistoricalData.length - 1;
  const currentTechStock = lastIndex >= 0 ? stocksHistoricalData[lastIndex].TECH : 150.00;
  const currentRetailStock = lastIndex >= 0 ? stocksHistoricalData[lastIndex].RETL : 80.00;

  res.json({
<<<<<<< HEAD
    totalRevenue: kpis.totalRevenue,
    totalOrders: kpis.totalOrders,
    avgOrderValue: kpis.avgOrderValue,
    categorySales: {
      Tech: kpis.techSales,
      Retail: kpis.retailSales
=======
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalOrders,
    avgOrderValue,
    categorySales: {
      Tech: parseFloat(techSales.toFixed(2)),
      Retail: parseFloat(retailSales.toFixed(2))
>>>>>>> kairavi
    },
    currentStocks: {
      TECH: currentTechStock,
      RETL: currentRetailStock
    }
  });
});

// Backtesting API
<<<<<<< HEAD
app.post('/api/backtest', (req, res) => {
  const { strategyName, ticker, initialCapital } = req.body;
  if (!strategyName || !ticker) {
    return res.status(400).json({ error: 'Missing strategyName or ticker' });
  }
=======
app.post('/api/backtest', validate(schemas.backtest), (req, res) => {
  const { strategyName, ticker, initialCapital } = req.body;
>>>>>>> kairavi

  const result = runBacktest(
    strategyName, 
    ticker, 
    initialCapital ? parseFloat(initialCapital) : 10000
  );

  res.json(result);
});

// Stocks Historical API
app.get('/api/stocks', (req, res) => {
  res.json(stocksHistoricalData);
});

// Chatbot Parser API
<<<<<<< HEAD
app.post('/api/assistant', async (req, res) => {
  const { query, cart, sessionId = 'default-session', userId = 'demo-user' } = req.body;
  assistantMetrics.totalRequests += 1;
  assistantMetrics.lastRequestAt = new Date().toISOString();

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  if (!enforceAssistantRateLimit(sessionId)) {
    assistantMetrics.blockedRequests += 1;
    return res.status(429).json({
      textResponse: 'Too many requests in a short period. Please wait a few seconds and try again.',
      actions: [],
      recommendations: [],
      meta: { mode: 'rate_limited', sessionId, userId }
    });
  }

  const validity = validateAssistantInput(query);
  if (!validity.valid) {
    assistantMetrics.blockedRequests += 1;
    return res.status(400).json({
      textResponse: validity.reason,
      actions: [],
      recommendations: buildRecommendations(cart || [], query),
      meta: { mode: 'guardrail_blocked', sessionId, userId }
    });
  }

  appendSessionHistory(sessionId, 'user', validity.sanitized);

  const llmResult = await tryLLMAssistantResponse(validity.sanitized, cart || [], sessionId);
  const parserFallbackResult = parseAssistantQuery(validity.sanitized, cart || []);
  const selected = llmResult || parserFallbackResult;
  const cleanTextResponse = String(selected.textResponse || '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '');

  if (llmResult) {
    assistantMetrics.llmResponses += 1;
  } else {
    assistantMetrics.ruleEngineResponses += 1;
  }

  assistantMetrics.actionCalls += selected.actions.length;
  appendSessionHistory(sessionId, 'assistant', cleanTextResponse);

  res.json({
    ...selected,
    textResponse: cleanTextResponse,
    recommendations: buildRecommendations(cart || [], query),
    meta: {
      mode: llmResult ? 'llm' : 'rule_engine',
      sessionId,
      userId,
      llmEnabled: Boolean(process.env.OPENAI_API_KEY)
    }
  });
});

app.get('/api/assistant/health', (req, res) => {
  res.json({
    ...assistantMetrics,
    llmEnabled: Boolean(process.env.OPENAI_API_KEY),
    activeSessions: assistantSessions.size
  });
=======
app.post('/api/assistant', strictLimiter, validate(schemas.assistantQuery), (req, res) => {
  const { query, cart } = req.body;

  const parseResult = parseAssistantQuery(query, cart || []);
  res.json(parseResult);
>>>>>>> kairavi
});

// Reset Sandbox API
app.post('/api/reset', (req, res) => {
  catalog = JSON.parse(JSON.stringify(INITIAL_CATALOG));
  generateSeedData();
  res.json({ success: true, message: 'Sandbox data reset successfully.' });
});

<<<<<<< HEAD
// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Enterprise Intelligence Platform backend running at http://localhost:${PORT}`);
});
=======
// --- 404 + centralized error handling (must be registered LAST) ---
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Enterprise Intelligence Platform backend running at http://localhost:${PORT} [${config.env}]`);
});

// Graceful shutdown: stop accepting new connections, let in-flight requests finish
const shutdown = (signal) => {
  logger.info(`${signal} received: shutting down gracefully`);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref(); // force-exit if it hangs
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
>>>>>>> kairavi
