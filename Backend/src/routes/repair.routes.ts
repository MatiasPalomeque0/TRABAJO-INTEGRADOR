import { Router } from 'express';
import * as controller from '../controllers/repair.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export const repairRouter = Router();
repairRouter.use(authenticate);
repairRouter.get('/', controller.list);
repairRouter.post('/', controller.create);
repairRouter.get('/:id', controller.get);
repairRouter.post('/:id/assign', controller.assign);
repairRouter.patch('/:id/status', controller.updateStatus);
repairRouter.post('/:id/diagnosis', controller.addDiagnosis);
repairRouter.post('/:id/work-logs', controller.addWorkLog);
repairRouter.post('/:id/estimates', controller.createEstimate);
repairRouter.patch('/:id/estimates/:estimateId/status', controller.updateEstimateStatus);
repairRouter.patch('/:id/estimates/:estimateId/presential-decision', controller.presentialDecision);
repairRouter.post('/:id/photos', controller.addPhoto);
repairRouter.post('/:id/delivery', controller.createDelivery);
repairRouter.get('/:id/delivery', controller.getDelivery);

