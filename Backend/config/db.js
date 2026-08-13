import 'dotenv/config';
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
dns.setDefaultResultOrder('ipv4first');
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Transaction from '../models/Transaction.js';
import StockHistory from '../models/StockHistory.js';

export const INITIAL_CATALOG = [
  { id: 'prod_1', name: 'Quantum Laptop Pro', category: 'Tech', price: 1499.99, inventory: 45, rating: 4.8 },
  { id: 'prod_2', name: 'Titanium Smartphone 15', category: 'Tech', price: 999.99, inventory: 60, rating: 4.7 },
  { id: 'prod_3', name: 'AcousticANC Headphones', category: 'Tech', price: 299.99, inventory: 80, rating: 4.5 },
  { id: 'prod_4', name: 'Apex Running Shoes', category: 'Retail', price: 129.99, inventory: 120, rating: 4.4 },
  { id: 'prod_5', name: 'Barista Brewer Pro', category: 'Retail', price: 199.99, inventory: 35, rating: 4.6 },
  { id: 'prod_6', name: 'HydroSport Smart Bottle', category: 'Retail', price: 49.99, inventory: 150, rating: 4.2 }
];

export function generateSeedData() {
  const data = [];
  const seedTransactions = [];
  const now = new Date();
  
  let techPrice = 150.00;
  let retlPrice = 80.00;

  for (let i = 30; i >= 0; i--) {
    const currentDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = currentDate.toISOString().split('T')[0];

    const txCount = Math.floor(Math.random() * 3) + 1;
    let techVolumeToday = 0;
    let retailVolumeToday = 0;

    for (let t = 0; t < txCount; t++) {
      const product = INITIAL_CATALOG[Math.floor(Math.random() * INITIAL_CATALOG.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      const totalPrice = parseFloat((product.price * qty).toFixed(2));
      const txTime = new Date(currentDate.getTime() + Math.floor(Math.random() * 8 * 60 * 60 * 1000));

      seedTransactions.push({
        id: `tx_${Math.random().toString(36).substring(2, 9)}`,
        productId: product.id,
        productName: product.name,
        category: product.category,
        quantity: qty,
        price: product.price,
        totalPrice: totalPrice,
        timestamp: txTime
      });

      if (product.category === 'Tech') {
        techVolumeToday += qty;
      } else {
        retailVolumeToday += qty;
      }
    }

    const techGrowth = (techVolumeToday - 2) * 0.4 + (Math.random() - 0.48) * 2;
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

  seedTransactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return {
    catalog: INITIAL_CATALOG,
    transactions: seedTransactions,
    stocksHistoricalData: data
  };
}

export async function seedDatabase() {
  try {
    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      console.log('Seeding MongoDB database with initial catalog, transactions, and stock history...');
      const seed = generateSeedData();
      
      await Product.insertMany(seed.catalog);
      await Transaction.insertMany(seed.transactions);
      await StockHistory.insertMany(seed.stocksHistoricalData);

      console.log('MongoDB seeding complete!');
    }
  } catch (error) {
    console.error('Error seeding MongoDB:', error);
  }
}

export async function resetDatabase() {
  try {
    await Product.deleteMany({});
    await Transaction.deleteMany({});
    await StockHistory.deleteMany({});

    const seed = generateSeedData();
    await Product.insertMany(seed.catalog);
    await Transaction.insertMany(seed.transactions);
    await StockHistory.insertMany(seed.stocksHistoricalData);

    console.log('MongoDB reset & re-seeded successfully!');
  } catch (error) {
    console.error('Error resetting MongoDB:', error);
    throw error;
  }
}

export async function connectDB() {
  const mongoURI =
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/enterprise_intelligence';

  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`🍃 Connected to MongoDB`);

    await seedDatabase();
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
  }
}