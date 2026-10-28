import { Router } from 'express';
import * as controller from '../controllers/customer.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export const customerRouter = Router();
customerRouter.use(authenticate);
customerRouter.get('/', controller.list);
customerRouter.post('/', controller.create);
customerRouter.get('/:id', controller.get);
customerRouter.patch('/:id', controller.update);
customerRouter.patch('/:id/status', controller.updateStatus);
