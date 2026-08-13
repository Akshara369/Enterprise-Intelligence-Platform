import Product from '../models/Product.js';

export async function searchProducts({
  query,
  category,
  minPrice,
  maxPrice,
  minRating,
  inStock = false,
  limit = 10
} = {}) {
  const filter = {};

  if (query) {
    filter.$or = [
      { name: { $regex: query, $options: 'i' } },
      { category: { $regex: query, $options: 'i' } }
    ];
  }

  if (category) {
    filter.category = {
      $regex: category,
      $options: 'i'
    };
  }

  if (minPrice !== undefined) {
    filter.price = {
      ...(filter.price || {}),
      $gte: Number(minPrice)
    };
  }

  if (maxPrice !== undefined) {
    filter.price = {
      ...(filter.price || {}),
      $lte: Number(maxPrice)
    };
  }

  if (minRating !== undefined) {
    filter.rating = {
      $gte: Number(minRating)
    };
  }

  if (inStock) {
    filter.inventory = { $gt: 0 };
  }

  const products = await Product.find(filter)
    .sort({ rating: -1, inventory: -1 })
    .limit(Math.min(Number(limit) || 10, 50))
    .lean();

  return products;
}


export async function getProductDetails(productId) {
  return Product.findOne({ id: productId }).lean();
}


export async function checkInventory(productId) {
  const product = await Product.findOne(
    { id: productId },
    {
      id: 1,
      name: 1,
      inventory: 1
    }
  ).lean();

  if (!product) {
    return null;
  }

  return {
    productId: product.id,
    name: product.name,
    inventory: product.inventory,
    inStock: product.inventory > 0,
    lowStock:
      product.inventory > 0 &&
      product.inventory <= 5
  };
}

export async function recommendProducts({
  category,
  maxPrice,
  minRating = 0,
  limit = 5
} = {}) {
  const products = await searchProducts({
    category,
    maxPrice,
    minRating,
    inStock: true,
    limit: 50
  });

  if (!products.length) {
    return [];
  }

  const budget = Number(maxPrice) || Infinity;
  const ratingFloor = Number(minRating) || 0;

  const scored = products.map((product) => {
    let score = 0;

    // Rating: up to 40 points
    score += Math.min(product.rating / 5, 1) * 40;

    // Price/value: up to 30 points
    if (budget !== Infinity) {
      const priceRatio = product.price / budget;

      if (priceRatio <= 0.7) {
        score += 30;
      } else if (priceRatio <= 0.9) {
        score += 25;
      } else if (priceRatio <= 1) {
        score += 20;
      }
    } else {
      score += 15;
    }

    // Inventory: up to 15 points
    if (product.inventory > 10) {
      score += 15;
    } else if (product.inventory > 5) {
      score += 10;
    } else {
      score += 5;
    }

    // Minimum rating preference
    if (product.rating >= ratingFloor) {
      score += 15;
    }

    return {
      ...product,
      recommendationScore: Math.round(score),
      recommendationReasons: [
        product.rating >= 4.5
          ? 'High customer rating'
          : 'Good customer rating',

        budget !== Infinity && product.price <= budget
          ? 'Within your budget'
          : 'Good value',

        product.inventory > 5
          ? 'Currently in stock'
          : 'Limited stock'
      ]
    };
  });

  return scored
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, Math.min(Number(limit) || 5, 10));
}