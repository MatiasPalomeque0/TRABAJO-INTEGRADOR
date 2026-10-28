import { pool } from '../config/db.js';

export async function createNotification(userId: number, type: string, title: string, body: string): Promise<void> {
  await pool.execute('INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)', [userId, type, title, body]);
}

