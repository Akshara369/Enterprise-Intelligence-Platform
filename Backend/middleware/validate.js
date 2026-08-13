import { z } from 'zod';
import { AppError } from './errorHandler.js';

// Generic middleware factory: validate(schema) checks req.body against a zod schema.
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return next(new AppError(message, 400, 'VALIDATION_ERROR'));
  }
  req.body = result.data; // use the parsed/typed version downstream
  next();
};

// Schemas matching the existing routes in server.js
export const schemas = {
  createTransaction: z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
  }),
  checkout: z.object({
    cartItems: z
      .array(
        z.object({
          product: z.object({ id: z.string().min(1) }).passthrough(),
          quantity: z.number().int().positive(),
        })
      )
      .min(1),
  }),
  backtest: z.object({
    strategyName: z.string().min(1),
    ticker: z.string().min(1),
    initialCapital: z.union([z.number(), z.string()]).optional(),
  }),
  assistantQuery: z.object({
    query: z.string().min(1),
    cart: z.array(z.any()).optional(),
  }),
};
