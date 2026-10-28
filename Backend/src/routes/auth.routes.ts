import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authRateLimit } from '../middlewares/security.middleware.js';
import * as invitationController from '../controllers/invitation.controller.js';

export const authRouter = Router();
authRouter.post('/register', authRateLimit, controller.register);
authRouter.post('/employee-invitations/accept', authRateLimit, invitationController.accept);
authRouter.post('/login', authRateLimit, controller.login);
authRouter.post('/refresh', authRateLimit, controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', authenticate, controller.me);
authRouter.get('/oauth/:provider/start', authRateLimit, controller.startOAuth);
authRouter.get('/oauth/:provider/callback', controller.oauthCallback);
authRouter.post('/oauth/:provider/exchange', authRateLimit, controller.exchangeOAuth);

