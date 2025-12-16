const db = require('../config/database');

class MessageService {
  async logMessage(messageData) {
    const { userId, accountId = null, phoneNumber, message, messageId, status = 'sent', errorMessage = null } = messageData;

    const query = `
      INSERT INTO whatsapp_messages (user_id, account_id, phone_number, message, message_id, status, error_message)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [userId, accountId, phoneNumber, message, messageId, status, errorMessage];

    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error guardando mensaje en DB:', error);
      // No lanzamos error para que no afecte el envío del mensaje
      return null;
    }
  }

  async getMessagesByUser(userId, limit = 100) {
    const query = `
      SELECT id, phone_number, message, message_id, status, error_message, sent_at
      FROM whatsapp_messages
      WHERE user_id = $1
      ORDER BY sent_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [userId, limit]);
    return result.rows;
  }

  async getMessageStats(userId) {
    const query = `
      SELECT
        COUNT(*) as total_messages,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
        COUNT(DISTINCT phone_number) as unique_recipients
      FROM whatsapp_messages
      WHERE user_id = $1
    `;

    const result = await db.query(query, [userId]);
    return result.rows[0];
  }

  async updateMessageStatus(messageId, status, errorMessage = null) {
    const query = `
      UPDATE whatsapp_messages
      SET status = $1, error_message = $2
      WHERE message_id = $3
      RETURNING *
    `;

    const result = await db.query(query, [status, errorMessage, messageId]);
    return result.rows[0];
  }
}

module.exports = new MessageService();
