import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB, resetDatabase } from './config/db.js';
import Product from './models/Product.js';
import Transaction from './models/Transaction.js';
import StockHistory from './models/StockHistory.js';

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

app.use(cors({ origin: config.corsOrigin || '*' }));
app.use(express.json());
app.use(httpLogger); // structured request logging
app.use(metricsCollector); // prometheus request metrics
app.use(healthRouter); // /health and /ready
app.use(metricsRouter); // /metrics
app.use('/api', generalLimiter); // baseline rate limit for API routes

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

// Chatbot Parser API
app.post('/api/assistant', async (req, res) => {
  try {
    const { query, cart } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const parseResult = await parseAssistantQuery(query, cart || []);
    res.json(parseResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
