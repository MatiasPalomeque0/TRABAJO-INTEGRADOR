import { Router } from 'express';
import * as controller from '../controllers/project.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export const projectRouter = Router();
projectRouter.use(authenticate);
projectRouter.get('/', controller.list);
projectRouter.post('/', controller.create);
projectRouter.get('/:id', controller.get);
projectRouter.patch('/:id', controller.update);
projectRouter.delete('/:id', controller.remove);
projectRouter.post('/:id/members', controller.addMember);
projectRouter.delete('/:id/members/:userId', controller.removeMember);

