import Transaction from '../models/Transaction.js';

export async function getSalesKPIs() {
  const result = await Transaction.aggregate([
    {
      $group: {
        _id: null,
        revenue: { $sum: '$totalPrice' },
        transactions: { $sum: 1 },
        units: { $sum: '$quantity' },
        averageOrderValue: { $avg: '$totalPrice' }
      }
    }
  ]);

  const data = result[0];

  if (!data) {
    return {
      revenue: 0,
      transactions: 0,
      units: 0,
      averageOrderValue: 0
    };
  }

  return {
    revenue: Number(data.revenue.toFixed(2)),
    transactions: data.transactions,
    units: data.units,
    averageOrderValue: Number(
      data.averageOrderValue.toFixed(2)
    )
  };
}


export async function getTopProducts(limit = 5) {
  return Transaction.aggregate([
    {
      $group: {
        _id: '$productId',
        productName: {
          $first: '$productName'
        },
        category: {
          $first: '$category'
        },
        unitsSold: {
          $sum: '$quantity'
        },
        revenue: {
          $sum: '$totalPrice'
        }
      }
    },
    {
      $sort: {
        revenue: -1
      }
    },
    {
      $limit: Math.min(Number(limit) || 5, 20)
    }
  ]);
}


export async function getCategoryPerformance() {
  return Transaction.aggregate([
    {
      $group: {
        _id: '$category',
        revenue: {
          $sum: '$totalPrice'
        },
        unitsSold: {
          $sum: '$quantity'
        },
        transactions: {
          $sum: 1
        }
      }
    },
    {
      $sort: {
        revenue: -1
      }
    }
  ]);
}


export async function getSalesInsights() {
  const [kpis, topProducts, categories] =
    await Promise.all([
      getSalesKPIs(),
      getTopProducts(5),
      getCategoryPerformance()
    ]);

  return {
    kpis,
    topProducts,
    categories
  };
}