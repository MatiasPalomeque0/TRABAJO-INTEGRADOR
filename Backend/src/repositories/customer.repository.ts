import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/db.js';
import { AppError } from '../utils/errors.js';
import type { CustomerRecord } from '../types/techfix.js';

type CustomerRow = RowDataPacket & {
  id: number;
  first_name: string;
  last_name: string;
  document_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

function mapCustomer(row: CustomerRow): CustomerRecord {
  return { id: row.id, firstName: row.first_name, lastName: row.last_name, documentNumber: row.document_number, email: row.email, phone: row.phone, address: row.address, notes: row.notes, isActive: Boolean(row.is_active), createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at };
}

const selectCustomer = 'SELECT id, first_name, last_name, document_number, email, phone, address, notes, is_active, created_by, created_at, updated_at FROM customers';

export async function findCustomerById(id: number): Promise<CustomerRecord | null> {
  const [rows] = await pool.query<CustomerRow[]>(`${selectCustomer} WHERE id = ?`, [id]);
  return rows[0] ? mapCustomer(rows[0]) : null;
}

export async function listCustomers(search: string | undefined, page: number, pageSize: number): Promise<{ items: CustomerRecord[]; total: number }> {
  const term = search ? `%${search}%` : null;
  const where = term ? 'WHERE CONCAT(first_name, \' \', last_name) LIKE ? OR email LIKE ? OR phone LIKE ? OR document_number LIKE ?' : '';
  const params = term ? [term, term, term, term] : [];
  const [countRows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM customers ${where}`, params);
  const [rows] = await pool.query<CustomerRow[]>(`${selectCustomer} ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]);
  return { items: rows.map(mapCustomer), total: Number(countRows[0]?.total ?? 0) };
}

export async function createCustomer(input: { firstName: string; lastName: string; documentNumber?: string | null; email?: string | null; phone?: string | null; address?: string | null; notes?: string | null; createdBy: number }): Promise<CustomerRecord> {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO customers (first_name, last_name, document_number, email, phone, address, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [input.firstName, input.lastName, input.documentNumber ?? null, input.email ?? null, input.phone ?? null, input.address ?? null, input.notes ?? null, input.createdBy]
    );
    const customer = await findCustomerById(Number(result.insertId));
    if (!customer) throw new AppError(500, 'CUSTOMER_CREATE_FAILED', 'No se pudo recuperar el cliente creado.');
    return customer;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') throw new AppError(409, 'CUSTOMER_DOCUMENT_EXISTS', 'El documento ya está registrado.');
    throw error;
  }
}

export async function updateCustomer(id: number, input: Partial<{ firstName: string; lastName: string; documentNumber: string | null; email: string | null; phone: string | null; address: string | null; notes: string | null }>): Promise<CustomerRecord> {
  const fields: string[] = [];
  const values: Array<string | null | number> = [];
  const mappings = [['firstName', 'first_name'], ['lastName', 'last_name'], ['documentNumber', 'document_number'], ['email', 'email'], ['phone', 'phone'], ['address', 'address'], ['notes', 'notes']] as const;
  for (const [key, column] of mappings) if (input[key] !== undefined) { fields.push(`${column} = ?`); values.push(input[key] as string | null); }
  try {
    if (fields.length) await pool.query(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
    const customer = await findCustomerById(id);
    if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Cliente no encontrado.');
    return customer;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') throw new AppError(409, 'CUSTOMER_DOCUMENT_EXISTS', 'El documento ya está registrado.');
    throw error;
  }
}

export async function setCustomerStatus(id: number, isActive: boolean): Promise<CustomerRecord> {
  const [result] = await pool.execute<ResultSetHeader>('UPDATE customers SET is_active = ? WHERE id = ?', [isActive, id]);
  if (!result.affectedRows) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Cliente no encontrado.');
  const customer = await findCustomerById(id);
  if (!customer) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Cliente no encontrado.');
  return customer;
}
