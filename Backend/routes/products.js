import { Router } from 'express';

import {
  searchProducts,
  getProductDetails,
  checkInventory,
  recommendProducts
} from '../services/productService.js';

const router = Router();

router.get('/search', async (req, res, next) => {
  try {
    const products = await searchProducts({
      query: req.query.query,
      category: req.query.category,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      minRating: req.query.minRating,
      inStock: req.query.inStock === 'true',
      limit: req.query.limit
    });

    res.json({
      count: products.length,
      products
    });
  } catch (error) {
    next(error);
  }
});


router.get('/recommendations', async (req, res, next) => {
  try {
    const products = await recommendProducts({
      category: req.query.category,
      maxPrice: req.query.maxPrice,
      minRating: req.query.minRating,
      limit: req.query.limit
    });

    res.json({
      count: products.length,
      products
    });
  } catch (error) {
    next(error);
  }
});


router.get('/:id/inventory', async (req, res, next) => {
  try {
    const result = await checkInventory(req.params.id);

    if (!result) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});


router.get('/:id', async (req, res, next) => {
  try {
    const product = await getProductDetails(req.params.id);

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    res.json(product);
  } catch (error) {
    next(error);
  }
});


export default router;