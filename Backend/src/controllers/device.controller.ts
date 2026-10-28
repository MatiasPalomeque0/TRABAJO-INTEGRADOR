import type { RequestHandler } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { deviceSchema } from '../validators/techfix.validators.js';
import * as devices from '../repositories/device.repository.js';
import { findCustomerById } from '../repositories/customer.repository.js';
import type { DeviceType } from '../types/techfix.js';
import { canManageDevices, isAdmin, isClient, isReceptionist, isTechnician } from '../utils/techfix-permissions.js';

function currentUser(req: Parameters<RequestHandler>[0]) { if (!req.user) throw new AppError(401, 'AUTH_REQUIRED', 'Se requiere autenticación.'); return req.user; }

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
  if (isAdmin(user) || isReceptionist(user)) { res.json({ data: await devices.listDevices({ customerId: req.query.customerId ? Number(req.query.customerId) : undefined, search }) }); return; }
  if (isClient(user)) { res.json({ data: await devices.listDevices({ ownerId: user.id, search }) }); return; }
  throw new AppError(403, 'FORBIDDEN', 'Los técnicos solo pueden consultar equipos de reparaciones asignadas.');
});

export const get: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const device = await devices.findDevice(Number(req.params.id));
  if (!device) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Equipo no encontrado.');
  if (isAdmin(user) || isReceptionist(user)) { res.json({ data: device }); return; }
  if (isClient(user) && device.ownerId === user.id) { res.json({ data: device }); return; }
  if (isTechnician(user) && await devices.hasAssignedRepair(device.id, user.id)) { res.json({ data: device }); return; }
  throw new AppError(403, 'FORBIDDEN', 'No podés consultar este equipo.');
});

export const create: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  const input = deviceSchema.parse(req.body);
  if (isTechnician(user)) throw new AppError(403, 'FORBIDDEN', 'Los técnicos no pueden registrar equipos.');
  if (isReceptionist(user)) {
    if (!input.customerId) throw new AppError(422, 'CUSTOMER_REQUIRED', 'La recepción debe indicar el cliente comercial.');
    const customer = await findCustomerById(input.customerId);
    if (!customer || !customer.isActive) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'El cliente no existe o está desactivado.');
    const device = await devices.createDevice({ ...input, ownerId: null, customerId: input.customerId });
    res.status(201).json({ data: device }); return;
  }
  if (!canManageDevices(user)) throw new AppError(403, 'FORBIDDEN', 'No tenés permisos para registrar equipos.');
  if (isAdmin(user) && input.customerId) {
    const customer = await findCustomerById(input.customerId);
    if (!customer || !customer.isActive) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'El cliente no existe o está desactivado.');
  }
  const device = await devices.createDevice({ ...input, ownerId: isClient(user) ? user.id : input.customerId ? null : user.id, customerId: isAdmin(user) ? input.customerId ?? null : null });
  res.status(201).json({ data: device });
});

export const update: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  if (!canManageDevices(user)) throw new AppError(403, 'FORBIDDEN', 'Solo el propietario o administrador puede modificar equipos.');
  const device = await devices.findDevice(Number(req.params.id));
  if (!device) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Equipo no encontrado.');
  if (!isAdmin(user) && device.ownerId !== user.id) throw new AppError(403, 'FORBIDDEN', 'No podés modificar este equipo.');
  const input = deviceSchema.partial().parse(req.body) as Partial<{ deviceType: DeviceType; brand: string; model: string; serialNumber: string | null; description: string | null }>;
  res.json({ data: await devices.updateDevice(device.id, input) });
});

export const remove: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  if (!canManageDevices(user)) throw new AppError(403, 'FORBIDDEN', 'Solo el propietario o administrador puede eliminar equipos.');
  const device = await devices.findDevice(Number(req.params.id));
  if (!device) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Equipo no encontrado.');
  if (!isAdmin(user) && device.ownerId !== user.id) throw new AppError(403, 'FORBIDDEN', 'No podés eliminar este equipo.');
  await devices.deleteDevice(device.id);
  res.status(204).send();
});
