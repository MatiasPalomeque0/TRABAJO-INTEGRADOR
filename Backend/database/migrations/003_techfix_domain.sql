INSERT IGNORE INTO roles (slug, name) VALUES
  ('admin', 'Administrador'),
  ('tecnico', 'Técnico'),
  ('cliente', 'Cliente');

CREATE TABLE IF NOT EXISTS devices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id BIGINT UNSIGNED NOT NULL,
  device_type ENUM('desktop', 'notebook', 'all_in_one', 'impresora', 'otro') NOT NULL,
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(160) NOT NULL,
  serial_number VARCHAR(160) NULL,
  description VARCHAR(2000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_devices_owner (owner_id, created_at),
  UNIQUE KEY uq_device_serial (serial_number),
  CONSTRAINT fk_devices_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS services (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL UNIQUE,
  description VARCHAR(1000) NULL,
  reference_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_services_active (is_active, name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS repair_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id BIGINT UNSIGNED NOT NULL,
  assigned_technician_id BIGINT UNSIGNED NULL,
  problem_description VARCHAR(4000) NOT NULL,
  status ENUM('solicitud_recibida', 'pendiente_diagnostico', 'en_diagnostico', 'esperando_aprobacion_presupuesto', 'presupuesto_rechazado', 'en_reparacion', 'reparacion_finalizada', 'listo_para_retirar', 'entregado', 'cancelado') NOT NULL DEFAULT 'solicitud_recibida',
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  INDEX idx_repairs_status (status, updated_at),
  INDEX idx_repairs_technician (assigned_technician_id, status),
  INDEX idx_repairs_device (device_id, received_at),
  CONSTRAINT fk_repairs_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE RESTRICT,
  CONSTRAINT fk_repairs_technician FOREIGN KEY (assigned_technician_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS repair_status_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repair_request_id BIGINT UNSIGNED NOT NULL,
  previous_status VARCHAR(80) NULL,
  new_status VARCHAR(80) NOT NULL,
  changed_by BIGINT UNSIGNED NOT NULL,
  observation VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_repair_history (repair_request_id, created_at),
  CONSTRAINT fk_history_repair FOREIGN KEY (repair_request_id) REFERENCES repair_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_history_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS diagnoses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repair_request_id BIGINT UNSIGNED NOT NULL,
  technician_id BIGINT UNSIGNED NOT NULL,
  description VARCHAR(4000) NOT NULL,
  recommendation VARCHAR(2000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_diagnoses_repair (repair_request_id, created_at),
  CONSTRAINT fk_diagnoses_repair FOREIGN KEY (repair_request_id) REFERENCES repair_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_diagnoses_technician FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estimates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repair_request_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  status ENUM('borrador', 'pendiente_aprobacion', 'aprobado', 'rechazado', 'vencido') NOT NULL DEFAULT 'borrador',
  notes VARCHAR(2000) NULL,
  labor_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  parts_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME NULL,
  INDEX idx_estimates_repair (repair_request_id, created_at),
  CONSTRAINT fk_estimates_repair FOREIGN KEY (repair_request_id) REFERENCES repair_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_estimates_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS estimate_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  estimate_id BIGINT UNSIGNED NOT NULL,
  service_id BIGINT UNSIGNED NULL,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_estimate_items_estimate FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
  CONSTRAINT fk_estimate_items_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS repair_photos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repair_request_id BIGINT UNSIGNED NOT NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  file_data LONGTEXT NULL,
  mime_type VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_repair_photos (repair_request_id, created_at),
  CONSTRAINT fk_photos_repair FOREIGN KEY (repair_request_id) REFERENCES repair_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_photos_user FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

INSERT IGNORE INTO services (name, description, reference_price) VALUES
  ('Diagnóstico general', 'Revisión inicial de hardware y software.', 0),
  ('Limpieza y mantenimiento', 'Limpieza interna y mantenimiento preventivo.', 0),
  ('Instalación de sistema operativo', 'Instalación y configuración inicial.', 0);

