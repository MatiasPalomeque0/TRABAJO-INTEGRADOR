import type { RequestHandler } from 'express';
import { asyncHandler, AppError } from '../utils/errors.js';
import { createNotification } from '../services/notification.service.js';
import { audit } from '../services/audit.service.js';
import { assertRepairOpen } from '../utils/repair-lifecycle.js';
import { assignTechnicianSchema, deliverySchema, diagnosisSchema, estimateDecisionSchema, estimateSchema, estimateStatusSchema, repairPhotoSchema, repairSchema, repairStatusSchema, workLogSchema } from '../validators/techfix.validators.js';
import { idempotencyKeySchema } from '../validators/intake.validators.js';
import * as repairs from '../repositories/repair.repository.js';
import * as lifecycle from '../repositories/repair-lifecycle.repository.js';
import type { EstimateStatus, RepairStatus } from '../types/techfix.js';
import { canAccessRepair, canChangeEstimateStatus, canCreateRepairs, canManageCommercialRecords, isAdmin, isClient, isReceptionist, isTechnician } from '../utils/techfix-permissions.js';

function currentUser(req: Parameters<RequestHandler>[0]) {
  if (!req.user) throw new AppError(401, 'AUTH_REQUIRED', 'Se requiere autenticación.');
  return req.user;
}

async function repairOr404(id: number) {
  const repair = await repairs.findRepair(id);
  if (!repair) throw new AppError(404, 'REPAIR_NOT_FOUND', 'Reparación no encontrada.');
  return repair;
}

async function ensureRepairAccess(req: Parameters<RequestHandler>[0]) {
  const user = currentUser(req);
  const repair = await repairOr404(Number(req.params.id));
  if (!canAccessRepair(user, repair)) throw new AppError(403, 'FORBIDDEN', 'No tenés acceso a esta reparación.');
  return { user, repair };
}

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  res.json({ data: await repairs.listRepairs(user, { status: typeof req.query.status === 'string' ? req.query.status as RepairStatus : undefined, deviceId: req.query.deviceId ? Number(req.query.deviceId) : undefined, search: typeof req.query.search === 'string' ? req.query.search.trim() : undefined }) });
});

export const get: RequestHandler = asyncHandler(async (req, res) => {
  const { repair } = await ensureRepairAccess(req);
  res.json({ data: {
    ...repair,
    intake: await repairs.findIntake(repair.id),
    history: await repairs.listHistory(repair.id),
    diagnoses: await repairs.listDiagnoses(repair.id),
    estimates: await repairs.listEstimates(repair.id),
    estimateDecisions: await lifecycle.listEstimateDecisions(repair.id),
    workLogs: await lifecycle.listWorkLogs(repair.id),
    photos: await repairs.listPhotos(repair.id),
    delivery: await lifecycle.findDelivery(repair.id)
  } });
});

export const create: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  if (!canCreateRepairs(user)) throw new AppError(403, 'FORBIDDEN', 'Solo un cliente o administrador puede solicitar una reparación.');
  const repair = await repairs.createRepair({ ...repairSchema.parse(req.body), clientId: user.id });
  await audit(user.id, 'repair.created', 'repair_request', repair.id);
  res.status(201).json({ data: repair });
});

export const assign: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  if (!isAdmin(user)) throw new AppError(403, 'FORBIDDEN', 'Solo un administrador puede asignar técnicos.');
  const repairBeforeChange = await repairOr404(Number(req.params.id));
  const input = assignTechnicianSchema.parse(req.body);
  const repair = await repairs.assignTechnician({ repairId: repairBeforeChange.id, technicianId: input.technicianId, actorId: user.id, expectedStatus: input.expectedStatus ?? repairBeforeChange.status, expectedTechnicianId: input.expectedTechnicianId === undefined ? repairBeforeChange.technicianId : input.expectedTechnicianId });
  await createNotification(repair.technicianId!, 'repair.assigned', 'Nueva reparación asignada', `Tenés una reparación asignada: ${repair.deviceName}.`);
  res.json({ data: repair });
});

export const updateStatus: RequestHandler = asyncHandler(async (req, res) => {
  const { user, repair } = await ensureRepairAccess(req);
  if (isReceptionist(user)) throw new AppError(403, 'FORBIDDEN', 'Recepción no puede modificar estados técnicos.');
  const input = repairStatusSchema.parse(req.body);
  const role = isAdmin(user) ? 'admin' : isTechnician(user) ? 'tecnico' : 'cliente';
  const updated = await repairs.updateStatus({ repairId: repair.id, actorId: user.id, role, status: input.status, expectedStatus: input.expectedStatus ?? repair.status, observation: input.observation });
  if (updated.clientId && updated.clientId !== user.id) await createNotification(updated.clientId, 'repair.status_changed', 'Cambió el estado de tu reparación', `${updated.deviceName}: ${updated.status}.`);
  res.json({ data: updated });
});

export const addDiagnosis: RequestHandler = asyncHandler(async (req, res) => {
  const { user, repair } = await ensureRepairAccess(req);
  assertRepairOpen(repair.status);
  if (!(isAdmin(user) || (isTechnician(user) && repair.technicianId === user.id))) throw new AppError(403, 'FORBIDDEN', 'Solo el técnico asignado o administrador puede registrar el diagnóstico.');
  const diagnosis = await repairs.addDiagnosis({ repairId: repair.id, technicianId: user.id, actorRole: isTechnician(user) ? 'tecnico' : 'admin', ...diagnosisSchema.parse(req.body) });
  res.status(201).json({ data: diagnosis });
});

export const addWorkLog: RequestHandler = asyncHandler(async (req, res) => {
  const { user, repair } = await ensureRepairAccess(req);
  assertRepairOpen(repair.status);
  if (!(isAdmin(user) || (isTechnician(user) && repair.technicianId === user.id))) throw new AppError(403, 'FORBIDDEN', 'Solo el técnico asignado o administrador puede documentar el trabajo.');
  const workLog = await lifecycle.addWorkLog({ repairId: repair.id, recordedBy: user.id, actorRole: isTechnician(user) ? 'tecnico' : 'admin', ...workLogSchema.parse(req.body) });
  res.status(201).json({ data: workLog });
});

export const createEstimate: RequestHandler = asyncHandler(async (req, res) => {
  const { user, repair } = await ensureRepairAccess(req);
  assertRepairOpen(repair.status);
  if (!(isAdmin(user) || (isTechnician(user) && repair.technicianId === user.id))) throw new AppError(403, 'FORBIDDEN', 'Solo el técnico asignado o administrador puede crear presupuestos.');
  const estimate = await repairs.createEstimate({ repairId: repair.id, createdBy: user.id, actorRole: isTechnician(user) ? 'tecnico' : 'admin', ...estimateSchema.parse(req.body) });
  if (repair.clientId) await createNotification(repair.clientId, 'estimate.created', 'Nuevo presupuesto disponible', `Hay un presupuesto para ${repair.deviceName}.`);
  res.status(201).json({ data: estimate });
});

async function recordPresentialDecision(req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1], decision: 'aprobado' | 'rechazado', observation?: string | null) {
  const { user, repair } = await ensureRepairAccess(req);
  if (!(isAdmin(user) || isReceptionist(user))) throw new AppError(403, 'FORBIDDEN', 'Solo administración o recepción puede registrar una decisión presencial.');
  assertRepairOpen(repair.status);
  const estimateId = Number(req.params.estimateId);
  const result = await lifecycle.recordPresentialDecision({ repairId: repair.id, estimateId, decidedBy: user.id, decision, observation });
  const estimate = await repairs.findEstimate(estimateId);
  if (!estimate) throw new AppError(500, 'ESTIMATE_NOT_FOUND_AFTER_DECISION', 'No se pudo recuperar el presupuesto decidido.');
  if (repair.technicianId) await createNotification(repair.technicianId, 'estimate.presential_decision', 'Decisión presencial registrada', `${repair.deviceName}: ${decision}.`);
  res.json({ data: estimate, meta: { channel: 'presencial', repairStatus: result.repairStatus } });
}

export const updateEstimateStatus: RequestHandler = asyncHandler(async (req, res) => {
  const { user, repair } = await ensureRepairAccess(req);
  if (!canChangeEstimateStatus(user)) throw new AppError(403, 'FORBIDDEN', 'Tu rol no puede actualizar el estado del presupuesto.');
  assertRepairOpen(repair.status);
  const input = estimateStatusSchema.parse(req.body);
  const status = input.status as EstimateStatus;
  if ((isAdmin(user) || isReceptionist(user)) && (status === 'aprobado' || status === 'rechazado')) {
    await recordPresentialDecision(req, res, status, input.observation);
    return;
  }
  const allowed = isClient(user) ? ['aprobado', 'rechazado'] : ['vencido', 'reemplazado'];
  if (!allowed.includes(status) || (isClient(user) && status === 'reemplazado')) throw new AppError(403, 'FORBIDDEN', 'Tu rol no puede realizar esa decisión sobre el presupuesto.');
  const estimate = await repairs.findEstimate(Number(req.params.estimateId));
  if (!estimate || estimate.repairRequestId !== repair.id) throw new AppError(404, 'ESTIMATE_NOT_FOUND', 'Presupuesto no encontrado.');
  const channel = isClient(user) ? 'portal_legado' : 'administrativo';
  const updated = status === 'reemplazado' ? await repairs.replaceEstimate(estimate.id, repair.id, user.id, { status, channel }) : await repairs.updateEstimateStatus(estimate.id, repair.id, status, user.id, { status, channel });
  const recipientId = repair.technicianId ?? repair.clientId;
  if (recipientId) await createNotification(recipientId, 'estimate.updated', 'Presupuesto actualizado', `${repair.deviceName}: ${status}.`);
  res.json({ data: updated });
});

export const presentialDecision: RequestHandler = asyncHandler(async (req, res) => {
  const input = estimateDecisionSchema.parse(req.body);
  await recordPresentialDecision(req, res, input.decision, input.observation);
});

export const addPhoto: RequestHandler = asyncHandler(async (req, res) => {
  const { user, repair } = await ensureRepairAccess(req);
  assertRepairOpen(repair.status);
  if (!(isAdmin(user) || (isTechnician(user) && repair.technicianId === user.id))) throw new AppError(403, 'FORBIDDEN', 'Solo el técnico asignado puede adjuntar fotografías.');
  const photo = await repairs.addPhoto({ repairId: repair.id, uploadedBy: user.id, actorRole: isTechnician(user) ? 'tecnico' : 'admin', ...repairPhotoSchema.parse(req.body) });
  res.status(201).json({ data: photo });
});

export const createDelivery: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  if (!canManageCommercialRecords(user)) throw new AppError(403, 'FORBIDDEN', 'Solo administración o recepción puede registrar entregas.');
  const idempotencyKey = idempotencyKeySchema.parse(req.header('idempotency-key'));
  const input = deliverySchema.parse(req.body);
  const result = await lifecycle.createDelivery({ ...input, repairId: Number(req.params.id), deliveredBy: user.id, idempotencyKey });
  const repair = await repairOr404(Number(req.params.id));
  res.status(result.wasDuplicate ? 200 : 201).json({ data: { repair, delivery: result.delivery }, meta: { wasDuplicate: result.wasDuplicate } });
});

export const getDelivery: RequestHandler = asyncHandler(async (req, res) => {
  const user = currentUser(req);
  if (!canManageCommercialRecords(user)) throw new AppError(403, 'FORBIDDEN', 'Solo administración o recepción puede consultar constancias de entrega.');
  const delivery = await lifecycle.findDelivery(Number(req.params.id));
  if (!delivery) throw new AppError(404, 'DELIVERY_NOT_FOUND', 'Todavía no existe una constancia de entrega.');
  res.json({ data: delivery });
});
