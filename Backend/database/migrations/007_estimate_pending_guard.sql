ALTER TABLE estimates
  ADD COLUMN pending_repair_id BIGINT UNSIGNED
    GENERATED ALWAYS AS (CASE WHEN status = 'pendiente_aprobacion' THEN repair_request_id ELSE NULL END) STORED,
  ADD UNIQUE KEY uq_estimates_one_pending_per_repair (pending_repair_id);
