INSERT IGNORE INTO roles (slug, name) VALUES
  ('recepcionista', 'Recepcionista');

CREATE TABLE IF NOT EXISTS employee_invitations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  role_id TINYINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  invited_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_employee_invitations_email_status (email, used_at, expires_at),
  INDEX idx_employee_invitations_expiry (expires_at, used_at),
  CONSTRAINT fk_employee_invitations_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_employee_invitations_invited_by FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;
