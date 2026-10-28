import type { RequestHandler } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import * as repairs from '../repositories/repair.repository.js';
import { audit } from '../services/audit.service.js';
import { canManageCommercialRecords } from '../utils/techfix-permissions.js';
import { idempotencyKeySchema, intakeSchema } from '../validators/intake.validators.js';
import type { RepairStatus } from '../types/techfix.js';

function currentUser(req: Parameters<RequestHandler>[0]) { if (!req.user) throw new AppError(401, 'AUTH_REQUIRED', 'Se requiere autenticación.'); return req.user; }
function ensureReceptionAccess(req: Parameters<RequestHandler>[0]) { const user = currentUser(req); if (!canManageCommercialRecords(user)) throw new AppError(403, 'FORBIDDEN', 'Solo administración o recepción puede gestionar ingresos presenciales.'); return user; }

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const user = ensureReceptionAccess(req);
  res.json({ data: await repairs.listRepairs(user, { status: typeof req.query.status === 'string' ? req.query.status as RepairStatus : undefined, deviceId: req.query.deviceId ? Number(req.query.deviceId) : undefined, search: typeof req.query.search === 'string' ? req.query.search.trim() : undefined }) });
});

export const get: RequestHandler = asyncHandler(async (req, res) => {
  ensureReceptionAccess(req);
  const repair = await repairs.findRepair(Number(req.params.id));
  if (!repair) throw new AppError(404, 'REPAIR_NOT_FOUND', 'Orden no encontrada.');
  const intake = await repairs.findIntake(repair.id);
  if (!intake) throw new AppError(404, 'INTAKE_NOT_FOUND', 'La orden no tiene un ingreso presencial asociado.');
  res.json({ data: { repair, intake } });
});

export const create: RequestHandler = asyncHandler(async (req, res) => {
  const user = ensureReceptionAccess(req);
  const keyHeader = req.header('idempotency-key');
  if (!keyHeader) throw new AppError(422, 'IDEMPOTENCY_KEY_REQUIRED', 'La recepción requiere una clave de reintento.');
  const input = intakeSchema.parse(req.body);
  const result = await repairs.createPresentialIntake({ ...input, createdBy: user.id, idempotencyKey: idempotencyKeySchema.parse(keyHeader) });
  const repair = await repairs.findRepair(result.repairId);
  const intake = await repairs.findIntake(result.repairId);
  if (!repair || !intake) throw new AppError(500, 'INTAKE_CREATE_FAILED', 'No se pudo recuperar el ingreso creado.');
  if (!result.wasDuplicate) await audit(user.id, 'repair.intake_created', 'repair_request', result.repairId, { customerId: input.customerId, deviceId: input.deviceId, intakeId: result.intakeId, itemCount: input.items.length });
  res.status(result.wasDuplicate ? 200 : 201).json({ data: { repair, intake } });
});
