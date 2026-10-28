import { Router } from 'express';
import * as controller from '../controllers/intake.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export const intakeRouter = Router();
intakeRouter.use(authenticate);
intakeRouter.get('/', controller.list);
intakeRouter.post('/', controller.create);
intakeRouter.get('/:id', controller.get);
