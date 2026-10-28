ALTER TABLE estimates
  MODIFY COLUMN status ENUM('borrador', 'pendiente_aprobacion', 'aprobado', 'rechazado', 'vencido', 'reemplazado') NOT NULL DEFAULT 'borrador';
