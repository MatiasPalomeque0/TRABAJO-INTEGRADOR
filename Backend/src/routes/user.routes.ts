import { Router } from 'express';
import * as controller from '../controllers/user.controller.js';
import * as invitationController from '../controllers/invitation.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

export const userRouter = Router();
userRouter.use(authenticate);
userRouter.get('/', authorize('admin'), controller.getUsers);
userRouter.get('/technicians', authorize('admin'), controller.getTechnicians);
userRouter.post('/invitations', authorize('admin'), invitationController.create);
userRouter.get('/invitations', authorize('admin'), invitationController.list);
userRouter.get('/:id', controller.getUser);
userRouter.patch('/:id', controller.updateUser);
userRouter.patch('/:id/roles', authorize('admin'), controller.updateRoles);
userRouter.patch('/:id/status', authorize('admin'), controller.updateStatus);

