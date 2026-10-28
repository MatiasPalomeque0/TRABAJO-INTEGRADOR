import bcrypt from 'bcryptjs';
import { pool, withTransaction } from '../config/db.js';
import { findUserByEmail } from '../repositories/user.repository.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const firstName = process.env.ADMIN_FIRST_NAME?.trim() || 'Administrador';
const lastName = process.env.ADMIN_LAST_NAME?.trim() || 'TechFix';
if (!email || !password) throw new Error('Definí ADMIN_EMAIL y ADMIN_PASSWORD de forma temporal para crear el administrador.');
if (password.length < 8) throw new Error('ADMIN_PASSWORD debe tener al menos 8 caracteres.');

const existing = await findUserByEmail(email);
await withTransaction(async (connection) => {
  let userId: number;
  if (existing) {
    userId = existing.id;
    await connection.execute('UPDATE users SET is_active = 1 WHERE id = ?', [userId]);
  } else {
    const hash = await bcrypt.hash(password, 12);
    const [result] = await connection.execute('INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)', [firstName, lastName, email, hash]);
    userId = Number((result as { insertId: number }).insertId);
  }
  await connection.execute('INSERT IGNORE INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE slug = \'admin\'', [userId]);
});
console.log(`Administrador preparado para ${email}. Eliminá ADMIN_PASSWORD del entorno.`);
await pool.end();

