import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../utils/errors.js';

export function validate(schema: z.ZodTypeAny, source: 'body' | 'query' | 'params' = 'body'): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      next(new AppError(422, 'VALIDATION_ERROR', 'Los datos enviados no son válidos.', parsed.error.flatten()));
      return;
    }
    req[source] = parsed.data;
    next();
  };
}

