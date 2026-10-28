import { Router } from 'express';
import * as controller from '../controllers/misc.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

export const miscRouter = Router();
miscRouter.use(authenticate);
miscRouter.get('/notifications', controller.notifications);
miscRouter.patch('/notifications/:id/read', controller.markNotificationRead);
miscRouter.get('/stats/overview', controller.stats);
miscRouter.get('/audit', authorize('admin'), controller.auditLog);

