const db = require('../config/database');

/**
 * Servicio para gestionar cuentas de WhatsApp en PostgreSQL
 */
class AccountService {
  /**
   * Crea una nueva cuenta de WhatsApp para un usuario
   * @param {number} userId - ID del usuario propietario
   * @param {string} accountName - Nombre descriptivo de la cuenta
   * @returns {object} Cuenta creada
   */
  async createAccount(userId, accountName) {
    // Generar un clientId único basado en userId y timestamp
    const clientId = `user${userId}_${Date.now()}`;

    const result = await db.query(
      `INSERT INTO whatsapp_accounts (user_id, client_id, account_name, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [userId, clientId, accountName]
    );

    return result.rows[0];
  }

  /**
   * Obtiene todas las cuentas de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Array} Lista de cuentas
   */
  async getAccountsByUser(userId) {
    const result = await db.query(
      `SELECT * FROM whatsapp_accounts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Obtiene una cuenta por su clientId
   * @param {string} clientId - ID del cliente
   * @returns {object} Cuenta encontrada
   */
  async getAccountByClientId(clientId) {
    const result = await db.query(
      'SELECT * FROM whatsapp_accounts WHERE client_id = $1',
      [clientId]
    );
    return result.rows[0];
  }

  /**
   * Obtiene una cuenta por su ID
   * @param {number} accountId - ID de la cuenta
   * @returns {object} Cuenta encontrada
   */
  async getAccountById(accountId) {
    const result = await db.query(
      'SELECT * FROM whatsapp_accounts WHERE id = $1',
      [accountId]
    );
    return result.rows[0];
  }

  /**
   * Verifica si un usuario es propietario de una cuenta
   * @param {number} userId - ID del usuario
   * @param {string} clientId - ID del cliente
   * @returns {boolean} true si es propietario
   */
  async isOwner(userId, clientId) {
    const result = await db.query(
      'SELECT id FROM whatsapp_accounts WHERE user_id = $1 AND client_id = $2',
      [userId, clientId]
    );
    return result.rows.length > 0;
  }

  /**
   * Actualiza el estado de autenticación de una cuenta
   * @param {string} clientId - ID del cliente
   * @param {boolean} isReady - Si está lista
   * @param {string} phoneNumber - Número de teléfono (opcional)
   */
  async updateAuthStatus(clientId, isReady, phoneNumber = null) {
    const updates = ['is_ready = $2'];
    const params = [clientId, isReady];
    let paramIndex = 3;

    if (phoneNumber) {
      updates.push(`phone_number = $${paramIndex}`);
      params.push(phoneNumber);
      paramIndex++;
    }

    if (isReady) {
      updates.push(`authenticated_at = CURRENT_TIMESTAMP`);
    }

    const query = `
      UPDATE whatsapp_accounts
      SET ${updates.join(', ')}
      WHERE client_id = $1
      RETURNING *
    `;

    const result = await db.query(query, params);
    return result.rows[0];
  }

  /**
   * Actualiza el timestamp del último QR generado
   * @param {string} clientId - ID del cliente
   */
  async updateLastQR(clientId) {
    const result = await db.query(
      `UPDATE whatsapp_accounts
       SET last_qr_at = CURRENT_TIMESTAMP
       WHERE client_id = $1
       RETURNING *`,
      [clientId]
    );
    return result.rows[0];
  }

  /**
   * Desactiva una cuenta
   * @param {string} clientId - ID del cliente
   */
  async deactivateAccount(clientId) {
    const result = await db.query(
      `UPDATE whatsapp_accounts
       SET is_active = false, is_ready = false
       WHERE client_id = $1
       RETURNING *`,
      [clientId]
    );
    return result.rows[0];
  }

  /**
   * Elimina una cuenta (soft delete cambiando a inactiva, o hard delete)
   * @param {string} clientId - ID del cliente
   * @param {boolean} hardDelete - Si true, elimina permanentemente
   */
  async deleteAccount(clientId, hardDelete = false) {
    if (hardDelete) {
      const result = await db.query(
        'DELETE FROM whatsapp_accounts WHERE client_id = $1 RETURNING *',
        [clientId]
      );
      return result.rows[0];
    } else {
      return await this.deactivateAccount(clientId);
    }
  }

  /**
   * Actualiza el nombre de una cuenta
   * @param {string} clientId - ID del cliente
   * @param {string} accountName - Nuevo nombre
   */
  async updateAccountName(clientId, accountName) {
    const result = await db.query(
      `UPDATE whatsapp_accounts
       SET account_name = $2
       WHERE client_id = $1
       RETURNING *`,
      [clientId, accountName]
    );
    return result.rows[0];
  }

  /**
   * Obtiene estadísticas de una cuenta
   * @param {string} clientId - ID del cliente
   */
  async getAccountStats(clientId) {
    const result = await db.query(
      `SELECT
        wa.*,
        COUNT(wm.id) as total_messages,
        COUNT(CASE WHEN wm.status = 'sent' THEN 1 END) as sent_messages,
        COUNT(CASE WHEN wm.status = 'error' THEN 1 END) as error_messages
       FROM whatsapp_accounts wa
       LEFT JOIN whatsapp_messages wm ON wm.account_id = wa.id
       WHERE wa.client_id = $1
       GROUP BY wa.id`,
      [clientId]
    );
    return result.rows[0];
  }

  /**
   * Lista todas las cuentas activas (admin)
   * @returns {Array} Todas las cuentas activas
   */
  async getAllActiveAccounts() {
    const result = await db.query(
      'SELECT * FROM v_whatsapp_accounts_details WHERE is_active = true ORDER BY created_at DESC'
    );
    return result.rows;
  }
}

module.exports = new AccountService();
