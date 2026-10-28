USE techfix;

-- Crear usuarios reales desde /api/auth/register. Este seed solo asegura los roles base.
INSERT IGNORE INTO roles (slug, name) VALUES
  ('admin', 'Administrador'),
  ('tecnico', 'Técnico'),
  ('cliente', 'Cliente');

