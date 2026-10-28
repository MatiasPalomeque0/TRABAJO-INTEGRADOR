import type { RequestHandler } from 'express';
import { registerSchema, loginSchema, refreshSchema } from '../validators/auth.validators.js';
import * as auth from '../services/auth.service.js';
import * as oauth from '../services/oauth.service.js';
import { AppError, asyncHandler } from '../utils/errors.js';

export const register: RequestHandler = asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const result = await auth.register(input);
  res.status(201).json({ data: result });
});

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const result = await auth.login(input);
  res.json({ data: result });
});

export const refresh: RequestHandler = asyncHandler(async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  res.json({ data: await auth.refresh(refreshToken) });
});

export const logout: RequestHandler = asyncHandler(async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  await auth.logout(refreshToken);
  res.status(204).send();
});

export const me: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError(401, 'AUTH_REQUIRED', 'Se requiere autenticación.');
  res.json({ data: req.user });
});

export const startOAuth: RequestHandler = asyncHandler(async (req, res) => {
  const redirectUri = typeof req.query.redirectUri === 'string' ? req.query.redirectUri : '';
  res.json({ data: await oauth.startOAuth(String(req.params.provider), redirectUri) });
});

export const oauthCallback: RequestHandler = asyncHandler(async (req, res) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  if (!code || !state) throw new AppError(400, 'OAUTH_CALLBACK_INVALID', 'Faltan parámetros del callback OAuth.');
  res.redirect(await oauth.handleCallback(String(req.params.provider), code, state));
});

export const exchangeOAuth: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.body as { code?: string; state?: string };
  if (!body.code || !body.state) throw new AppError(422, 'OAUTH_EXCHANGE_INVALID', 'Se requieren code y state.');
  res.json({ data: await oauth.exchangeHandoff(body.code, body.state) });
});

