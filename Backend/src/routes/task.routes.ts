import { Router } from 'express';
import * as controller from '../controllers/task.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export const taskRouter = Router();
taskRouter.use(authenticate);
taskRouter.get('/', controller.list);
taskRouter.post('/', controller.create);
taskRouter.get('/:id', controller.get);
taskRouter.patch('/:id', controller.update);
taskRouter.delete('/:id', controller.remove);
taskRouter.post('/:id/comments', controller.addComment);
taskRouter.post('/:id/evidence', controller.addEvidence);
taskRouter.get('/:id/evidence', controller.listEvidence);

