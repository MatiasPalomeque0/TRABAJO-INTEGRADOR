import type { RequestHandler } from 'express';
import { asyncHandler } from '../utils/errors.js';
import { serviceSchema } from '../validators/techfix.validators.js';
import * as services from '../repositories/service.repository.js';

export const list: RequestHandler = asyncHandler(async (req, res) => { res.json({ data: await services.listServices(req.user?.roles.includes('admin') && req.query.includeInactive === 'true') }); });
export const create: RequestHandler = asyncHandler(async (req, res) => { res.status(201).json({ data: await services.createService(serviceSchema.parse(req.body)) }); });
export const update: RequestHandler = asyncHandler(async (req, res) => { res.json({ data: await services.updateService(Number(req.params.id), serviceSchema.partial().parse(req.body)) }); });

