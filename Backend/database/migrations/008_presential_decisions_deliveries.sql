CREATE TABLE IF NOT EXISTS estimate_decisions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  estimate_id BIGINT UNSIGNED NOT NULL,
  decision ENUM('aprobado', 'rechazado') NOT NULL,
  decided_by BIGINT UNSIGNED NOT NULL,
  channel ENUM('presencial') NOT NULL DEFAULT 'presencial',
  observation VARCHAR(2000) NULL,
  decided_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_estimate_decisions_estimate (estimate_id),
  INDEX idx_estimate_decisions_actor (decided_by, decided_at),
  CONSTRAINT fk_estimate_decisions_estimate FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE RESTRICT,
  CONSTRAINT fk_estimate_decisions_actor FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS repair_work_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repair_request_id BIGINT UNSIGNED NOT NULL,
  recorded_by BIGINT UNSIGNED NOT NULL,
  description VARCHAR(4000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_repair_work_logs_repair (repair_request_id, created_at),
  INDEX idx_repair_work_logs_actor (recorded_by, created_at),
  CONSTRAINT fk_repair_work_logs_repair FOREIGN KEY (repair_request_id) REFERENCES repair_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_repair_work_logs_actor FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS repair_deliveries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repair_request_id BIGINT UNSIGNED NOT NULL,
  delivered_by BIGINT UNSIGNED NOT NULL,
  picked_up_by_name VARCHAR(160) NOT NULL,
  delivered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  observations VARCHAR(2000) NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_repair_deliveries_repair (repair_request_id),
  UNIQUE KEY uq_repair_deliveries_idempotency (idempotency_key),
  INDEX idx_repair_deliveries_actor (delivered_by, delivered_at),
  CONSTRAINT fk_repair_deliveries_repair FOREIGN KEY (repair_request_id) REFERENCES repair_requests(id) ON DELETE RESTRICT,
  CONSTRAINT fk_repair_deliveries_actor FOREIGN KEY (delivered_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
