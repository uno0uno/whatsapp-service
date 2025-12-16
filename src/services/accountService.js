const db = require('../config/database');

/**
 * Service to manage WhatsApp accounts in PostgreSQL
 */
class AccountService {
  /**
   * Creates a new WhatsApp account for a user
   * @param {number} userId - Owner user ID
   * @param {string} accountName - Descriptive name of the account
   * @returns {object} Created account
   */
  async createAccount(userId, accountName) {
    // Generate a unique clientId based on userId and timestamp
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
   * Gets all accounts of a user
   * @param {number} userId - User ID
   * @returns {Array} List of accounts
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
   * Gets an account by its clientId
   * @param {string} clientId - Client ID
   * @returns {object} Found account
   */
  async getAccountByClientId(clientId) {
    const result = await db.query(
      'SELECT * FROM whatsapp_accounts WHERE client_id = $1',
      [clientId]
    );
    return result.rows[0];
  }

  /**
   * Gets an account by its ID
   * @param {number} accountId - Account ID
   * @returns {object} Found account
   */
  async getAccountById(accountId) {
    const result = await db.query(
      'SELECT * FROM whatsapp_accounts WHERE id = $1',
      [accountId]
    );
    return result.rows[0];
  }

  /**
   * Verifies if a user is the owner of an account
   * @param {number} userId - User ID
   * @param {string} clientId - Client ID
   * @returns {boolean} true if owner
   */
  async isOwner(userId, clientId) {
    const result = await db.query(
      'SELECT id FROM whatsapp_accounts WHERE user_id = $1 AND client_id = $2',
      [userId, clientId]
    );
    return result.rows.length > 0;
  }

  /**
   * Updates the authentication status of an account
   * @param {string} clientId - Client ID
   * @param {boolean} isReady - Whether it's ready
   * @param {string} phoneNumber - Phone number (optional)
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
   * Updates the timestamp of the last QR generated
   * @param {string} clientId - Client ID
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
   * Deactivates an account
   * @param {string} clientId - Client ID
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
   * Deletes an account (soft delete by changing to inactive, or hard delete)
   * @param {string} clientId - Client ID
   * @param {boolean} hardDelete - If true, delete permanently
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
   * Updates the name of an account
   * @param {string} clientId - Client ID
   * @param {string} accountName - New name
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
   * Gets statistics for an account
   * @param {string} clientId - Client ID
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
   * Lists all active accounts (admin)
   * @returns {Array} All active accounts
   */
  async getAllActiveAccounts() {
    const result = await db.query(
      'SELECT * FROM v_whatsapp_accounts_details WHERE is_active = true ORDER BY created_at DESC'
    );
    return result.rows;
  }
}

module.exports = new AccountService();
