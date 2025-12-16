-- Tabla para gestionar múltiples cuentas de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id VARCHAR(100) UNIQUE NOT NULL,
  account_name VARCHAR(100), -- Nombre descriptivo de la cuenta
  phone_number VARCHAR(20), -- Se llena cuando se autentica
  is_active BOOLEAN DEFAULT false,
  is_ready BOOLEAN DEFAULT false,
  last_qr_at TIMESTAMP,
  authenticated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_whatsapp_accounts_user_id ON whatsapp_accounts(user_id);
CREATE INDEX idx_whatsapp_accounts_client_id ON whatsapp_accounts(client_id);
CREATE INDEX idx_whatsapp_accounts_active ON whatsapp_accounts(is_active);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_whatsapp_accounts_updated_at
  BEFORE UPDATE ON whatsapp_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_accounts_updated_at();

-- Modificar tabla whatsapp_messages para relacionar con la cuenta
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS account_id INTEGER REFERENCES whatsapp_accounts(id) ON DELETE SET NULL;

-- Crear índice para la nueva columna
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_account_id ON whatsapp_messages(account_id);

-- Vista para ver cuentas con información del usuario
CREATE OR REPLACE VIEW v_whatsapp_accounts_details AS
SELECT
  wa.id,
  wa.client_id,
  wa.account_name,
  wa.phone_number,
  wa.is_active,
  wa.is_ready,
  wa.authenticated_at,
  wa.created_at,
  u.username,
  u.email,
  u.full_name,
  (SELECT COUNT(*) FROM whatsapp_messages WHERE account_id = wa.id) as messages_count
FROM whatsapp_accounts wa
JOIN users u ON wa.user_id = u.id;

-- Comentarios para documentación
COMMENT ON TABLE whatsapp_accounts IS 'Almacena múltiples cuentas de WhatsApp por usuario';
COMMENT ON COLUMN whatsapp_accounts.client_id IS 'ID único del cliente WhatsApp (usado por whatsapp-web.js)';
COMMENT ON COLUMN whatsapp_accounts.account_name IS 'Nombre descriptivo asignado por el usuario';
COMMENT ON COLUMN whatsapp_accounts.phone_number IS 'Número de teléfono asociado (se obtiene después de autenticar)';
COMMENT ON COLUMN whatsapp_accounts.is_active IS 'Indica si la cuenta está activa en el sistema';
COMMENT ON COLUMN whatsapp_accounts.is_ready IS 'Indica si WhatsApp está autenticado y listo para enviar mensajes';
