import type { RequestHandler } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { audit } from '../services/audit.service.js';
import * as customers from '../repositories/customer.repository.js';
import { customerSchema, customerStatusSchema, customerUpdateSchema } from '../validators/customer.validators.js';
import { canManageCommercialRecords, isAdmin, isReceptionist } from '../utils/techfix-permissions.js';

function currentUser(req: Parameters<RequestHandler>[0]) { if (!req.user) throw new AppError(401, 'AUTH_REQUIRED', 'Se requiere autenticación.'); return req.user; }
function ensureAccess(req: Parameters<RequestHandler>[0]) { const user = currentUser(req); if (!canManageCommercialRecords(user)) throw new AppError(403, 'FORBIDDEN', 'Solo administración o recepción puede gestionar clientes comerciales.'); return user; }

export const list: RequestHandler = asyncHandler(async (req, res) => {
  ensureAccess(req);
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20)));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
  res.json({ data: await customers.listCustomers(search, page, pageSize), meta: { page, pageSize } });
});

export const get: RequestHandler = asyncHandler(async (req, res) => {
  ensureAccess(req);
  const customer = await customers.findCustomerById(Number(req.params.id));
  if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Cliente no encontrado.');
  res.json({ data: customer });
});

export const create: RequestHandler = asyncHandler(async (req, res) => {
  const user = ensureAccess(req);
  const customer = await customers.createCustomer({ ...customerSchema.parse(req.body), createdBy: user.id });
  await audit(user.id, 'customer.created', 'customer', customer.id);
  res.status(201).json({ data: customer });
});

export const update: RequestHandler = asyncHandler(async (req, res) => {
  const user = ensureAccess(req);
  const input = customerUpdateSchema.parse(req.body);
  const authorizedInput = isReceptionist(user) && !isAdmin(user) ? { email: input.email, phone: input.phone, address: input.address, notes: input.notes } : input;
  const customer = await customers.updateCustomer(Number(req.params.id), authorizedInput);
  await audit(user.id, 'customer.updated', 'customer', customer.id, { fields: Object.keys(authorizedInput) });
  res.json({ data: customer });
});

export const updateStatus: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  if (!isAdmin(user)) throw new AppError(403, 'FORBIDDEN', 'Solo un administrador puede desactivar clientes.');
  const customer = await customers.setCustomerStatus(Number(req.params.id), customerStatusSchema.parse(req.body).isActive);
  await audit(user.id, 'customer.status_updated', 'customer', customer.id, { isActive: customer.isActive });
  res.json({ data: customer });
});
