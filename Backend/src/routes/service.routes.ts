import { Router } from 'express';
import * as controller from '../controllers/service.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

export const serviceRouter = Router();
serviceRouter.use(authenticate);
serviceRouter.get('/', controller.list);
serviceRouter.post('/', authorize('admin'), controller.create);
serviceRouter.patch('/:id', authorize('admin'), controller.update);

