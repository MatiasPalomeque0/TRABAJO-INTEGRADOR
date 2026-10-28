import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import type { DeviceRecord, DeviceType } from '../types/techfix.js';

type DeviceRow = RowDataPacket & { id: number; owner_id: number | null; owner_name: string | null; customer_id: number | null; customer_name: string | null; device_type: DeviceType; brand: string; model: string; serial_number: string | null; description: string | null; created_at: string };
function mapDevice(row: DeviceRow): DeviceRecord { return { id: row.id, ownerId: row.owner_id, ownerName: row.owner_name, customerId: row.customer_id, customerName: row.customer_name, deviceType: row.device_type, brand: row.brand, model: row.model, serialNumber: row.serial_number, description: row.description, createdAt: row.created_at }; }

const deviceSelect = `SELECT d.id, d.owner_id, CONCAT(u.first_name, ' ', u.last_name) AS owner_name, d.customer_id, CONCAT(c.first_name, ' ', c.last_name) AS customer_name, d.device_type, d.brand, d.model, d.serial_number, d.description, d.created_at FROM devices d LEFT JOIN users u ON u.id = d.owner_id LEFT JOIN customers c ON c.id = d.customer_id`;

export async function listDevices(filters: { ownerId?: number; customerId?: number; search?: string } = {}): Promise<DeviceRecord[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.ownerId !== undefined) { conditions.push('d.owner_id = ?'); params.push(filters.ownerId); }
  if (filters.customerId !== undefined) { conditions.push('d.customer_id = ?'); params.push(filters.customerId); }
  if (filters.search) { conditions.push('(d.brand LIKE ? OR d.model LIKE ? OR d.serial_number LIKE ?)'); params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`); }
  const [rows] = await pool.query<DeviceRow[]>(`${deviceSelect} ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY d.created_at DESC`, params);
  return rows.map(mapDevice);
}

export async function findDevice(id: number): Promise<DeviceRecord | null> {
  const [rows] = await pool.query<DeviceRow[]>(`${deviceSelect} WHERE d.id = ?`, [id]);
  return rows[0] ? mapDevice(rows[0]) : null;
}

export async function hasAssignedRepair(deviceId: number, technicianId: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT 1 FROM repair_requests WHERE device_id = ? AND assigned_technician_id = ? LIMIT 1', [deviceId, technicianId]);
  return rows.length > 0;
}

export async function createDevice(input: { ownerId: number | null; customerId: number | null; deviceType: DeviceType; brand: string; model: string; serialNumber?: string | null; description?: string | null }): Promise<DeviceRecord> {
  try {
    const [result] = await pool.execute<ResultSetHeader>('INSERT INTO devices (owner_id, customer_id, device_type, brand, model, serial_number, description) VALUES (?, ?, ?, ?, ?, ?, ?)', [input.ownerId, input.customerId, input.deviceType, input.brand, input.model, input.serialNumber ?? null, input.description ?? null]);
    const device = await findDevice(Number(result.insertId));
    if (!device) throw new AppError(500, 'DEVICE_CREATE_FAILED', 'No se pudo recuperar el equipo creado.');
    return device;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') throw new AppError(409, 'SERIAL_ALREADY_EXISTS', 'El número de serie ya está registrado.');
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_NO_REFERENCED_ROW_2') throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'El cliente no existe.');
    throw error;
  }
}

export async function updateDevice(id: number, input: Partial<{ deviceType: DeviceType; brand: string; model: string; serialNumber: string | null; description: string | null }>): Promise<DeviceRecord> {
  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  const mappings = [['deviceType', 'device_type'], ['brand', 'brand'], ['model', 'model'], ['serialNumber', 'serial_number'], ['description', 'description']] as const;
  for (const [key, column] of mappings) if (input[key] !== undefined) { fields.push(`${column} = ?`); values.push(input[key] as string | null); }
  if (fields.length) await pool.query(`UPDATE devices SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
  const device = await findDevice(id);
  if (!device) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Equipo no encontrado.');
  return device;
}

export async function deleteDevice(id: number): Promise<void> {
  try {
    const [result] = await pool.execute<ResultSetHeader>('DELETE FROM devices WHERE id = ?', [id]);
    if (!result.affectedRows) throw new AppError(404, 'DEVICE_NOT_FOUND', 'Equipo no encontrado.');
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_ROW_IS_REFERENCED_2') throw new AppError(409, 'DEVICE_HAS_REPAIRS', 'No se puede eliminar un equipo con reparaciones.');
    throw error;
  }
}
