const bcrypt = require('bcryptjs');
const db = require('../config/database');

class UserService {
  async createUser(userData) {
    const { username, email, password, fullName, role = 'user' } = userData;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO users (username, email, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, email, full_name, role, is_active, created_at
    `;

    const values = [username, email, passwordHash, fullName, role];

    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('User or email already exists');
      }
      throw error;
    }
  }

  async findByUsername(username) {
    const query = `
      SELECT id, username, email, password_hash, full_name, role, is_active, created_at, last_login
      FROM users
      WHERE username = $1
    `;

    const result = await db.query(query, [username]);
    return result.rows[0];
  }

  async findById(id) {
    const query = `
      SELECT id, username, email, full_name, role, is_active, created_at, last_login
      FROM users
      WHERE id = $1
    `;

    const result = await db.query(query, [id]);
    return result.rows[0];
  }

  async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  async updateLastLogin(userId) {
    const query = `
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await db.query(query, [userId]);
  }

  async updateUser(userId, updates) {
    const allowedFields = ['email', 'full_name', 'is_active'];
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(userId);

    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, email, full_name, role, is_active
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  async changePassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const query = `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
    `;

    await db.query(query, [passwordHash, userId]);
  }

  async getAllUsers() {
    const query = `
      SELECT id, username, email, full_name, role, is_active, created_at, last_login
      FROM users
      ORDER BY created_at DESC
    `;

    const result = await db.query(query);
    return result.rows;
  }
}

module.exports = new UserService();
