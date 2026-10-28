import { Router } from 'express';
import * as controller from '../controllers/device.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export const deviceRouter = Router();
deviceRouter.use(authenticate);
deviceRouter.get('/', controller.list);
deviceRouter.post('/', controller.create);
deviceRouter.get('/:id', controller.get);
deviceRouter.patch('/:id', controller.update);
deviceRouter.delete('/:id', controller.remove);

