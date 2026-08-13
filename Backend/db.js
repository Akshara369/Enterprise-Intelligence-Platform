import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

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
        timestamp: txTime.toISOString()
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
    catalog: JSON.parse(JSON.stringify(INITIAL_CATALOG)),
    transactions: seedTransactions,
    stocksHistoricalData: data
  };
}

// Ensure data directory and db.json exist
function ensureDatabaseExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const defaultData = generateSeedData();
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
}

// Read database from file
export function readDB() {
  ensureDatabaseExists();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database, re-seeding:', err);
    const defaultData = generateSeedData();
    writeDB(defaultData);
    return defaultData;
  }
}

// Write database to file
export function writeDB(data) {
  ensureDatabaseExists();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Reset database to default seed state
export function resetDB() {
  const freshData = generateSeedData();
  writeDB(freshData);
  return freshData;
}
