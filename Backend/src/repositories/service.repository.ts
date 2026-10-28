import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';
import { AppError } from '../utils/errors.js';

export interface ServiceRecord { id: number; name: string; description: string | null; referencePrice: number; isActive: boolean; createdAt: string; }
type ServiceRow = RowDataPacket & { id: number; name: string; description: string | null; reference_price: number; is_active: number; created_at: string };
function mapService(row: ServiceRow): ServiceRecord { return { id: row.id, name: row.name, description: row.description, referencePrice: Number(row.reference_price), isActive: Boolean(row.is_active), createdAt: row.created_at }; }

export async function listServices(includeInactive = false): Promise<ServiceRecord[]> {
  const [rows] = await pool.query<ServiceRow[]>(`SELECT id, name, description, reference_price, is_active, created_at FROM services ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY name`);
  return rows.map(mapService);
}

export async function createService(input: { name: string; description?: string | null; referencePrice: number }): Promise<ServiceRecord> {
  try {
    const [result] = await pool.execute<ResultSetHeader>('INSERT INTO services (name, description, reference_price) VALUES (?, ?, ?)', [input.name, input.description ?? null, input.referencePrice]);
    const [rows] = await pool.query<ServiceRow[]>('SELECT id, name, description, reference_price, is_active, created_at FROM services WHERE id = ?', [result.insertId]);
    return mapService(rows[0]);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') throw new AppError(409, 'SERVICE_ALREADY_EXISTS', 'El servicio ya existe.');
    throw error;
  }
}

export async function updateService(id: number, input: Partial<{ name: string; description: string | null; referencePrice: number; isActive: boolean }>): Promise<ServiceRecord> {
  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  const mappings = [['name', 'name'], ['description', 'description'], ['referencePrice', 'reference_price'], ['isActive', 'is_active']] as const;
  for (const [key, column] of mappings) if (input[key] !== undefined) { fields.push(`${column} = ?`); values.push(input[key] as string | number | null); }
  if (fields.length) await pool.query(`UPDATE services SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
  const [rows] = await pool.query<ServiceRow[]>('SELECT id, name, description, reference_price, is_active, created_at FROM services WHERE id = ?', [id]);
  if (!rows[0]) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Servicio no encontrado.');
  return mapService(rows[0]);
}

