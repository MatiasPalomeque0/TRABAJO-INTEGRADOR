CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  document_number VARCHAR(40) NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(40) NULL,
  address VARCHAR(250) NULL,
  notes VARCHAR(2000) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customers_document (document_number),
  INDEX idx_customers_name (last_name, first_name),
  INDEX idx_customers_email (email),
  INDEX idx_customers_active (is_active, created_at),
  CONSTRAINT fk_customers_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

ALTER TABLE devices
  MODIFY COLUMN owner_id BIGINT UNSIGNED NULL,
  ADD COLUMN customer_id BIGINT UNSIGNED NULL,
  ADD INDEX idx_devices_customer (customer_id, created_at),
  ADD CONSTRAINT fk_devices_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;

ALTER TABLE repair_requests
  ADD COLUMN customer_id BIGINT UNSIGNED NULL,
  ADD COLUMN created_by BIGINT UNSIGNED NULL,
  ADD COLUMN intake_idempotency_key VARCHAR(100) NULL,
  ADD INDEX idx_repairs_customer (customer_id, updated_at),
  ADD INDEX idx_repairs_created_by (created_by, updated_at),
  ADD UNIQUE KEY uq_repairs_intake_idempotency (intake_idempotency_key),
  ADD CONSTRAINT fk_repairs_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_repairs_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS repair_intakes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repair_request_id BIGINT UNSIGNED NOT NULL,
  received_by BIGINT UNSIGNED NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  equipment_condition VARCHAR(2000) NULL,
  observations VARCHAR(4000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_repair_intakes_repair (repair_request_id),
  INDEX idx_repair_intakes_received_by (received_by, received_at),
  CONSTRAINT fk_repair_intakes_repair FOREIGN KEY (repair_request_id) REFERENCES repair_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_repair_intakes_received_by FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS repair_intake_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  repair_intake_id BIGINT UNSIGNED NOT NULL,
  description VARCHAR(250) NOT NULL,
  condition_at_intake VARCHAR(500) NULL,
  return_status ENUM('pendiente', 'devuelto', 'no_corresponde') NOT NULL DEFAULT 'pendiente',
  returned_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_repair_intake_items_intake (repair_intake_id, created_at),
  CONSTRAINT fk_repair_intake_items_intake FOREIGN KEY (repair_intake_id) REFERENCES repair_intakes(id) ON DELETE CASCADE
) ENGINE=InnoDB;
