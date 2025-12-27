const jwt = require('jsonwebtoken');
const config = require('../config/env');
const whatsappService = require('../services/whatsappService');
const userService = require('../services/userService');
const accountService = require('../services/accountService');

class AuthController {
  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required'
        });
      }

      // Search for user in database
      const user = await userService.findByUsername(username);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if user is active
      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          message: 'Inactive user. Contact the administrator.'
        });
      }

      // Verify password
      const isPasswordValid = await userService.verifyPassword(password, user.password_hash);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Update last login
      await userService.updateLastLogin(user.id);

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          role: user.role
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.json({
        success: true,
        token,
        expiresIn: config.jwt.expiresIn,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Error in login:', error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  async register(req, res) {
    try {
      const { username, email, password, fullName } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required'
        });
      }

      // Create user
      const user = await userService.createUser({
        username,
        email,
        password,
        fullName,
        role: 'user'
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Error in registration:', error);

      if (error.message === 'User or email already exists') {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }

  async getQRCode(req, res) {
    try {
      const { clientId } = req.query;
      const userId = req.user.id;

      if (!clientId) {
        return res.status(400).json({
          success: false,
          message: 'clientId is required as query parameter'
        });
      }

      // Verify ownership
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this account'
        });
      }

      const qrCode = whatsappService.getQRCode(clientId);
      const status = whatsappService.getStatus(clientId);

      if (!status.exists) {
        return res.status(404).json({
          success: false,
          message: 'Client does not exist. You must initialize it first.'
        });
      }

      if (!qrCode && status.isReady) {
        return res.json({
          success: true,
          message: 'WhatsApp is already authenticated',
          status
        });
      }

      if (!qrCode) {
        return res.status(404).json({
          success: false,
          message: 'QR Code not available. Wait a moment and try again.',
          status
        });
      }

      res.json({
        success: true,
        qrCode,
        message: 'Scan this QR code with WhatsApp'
      });
    } catch (error) {
      console.error('Error getting QR:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting QR code'
      });
    }
  }

  async getStatus(req, res) {
    try {
      const { clientId } = req.query;
      const userId = req.user.id;

      // If clientId is not provided, return status of all user accounts
      if (!clientId) {
        const accounts = await accountService.getAccountsByUser(userId);
        const allStatuses = accounts.map(account => ({
          clientId: account.client_id,
          accountName: account.account_name,
          status: whatsappService.getStatus(account.client_id)
        }));

        return res.json({
          success: true,
          accounts: allStatuses
        });
      }

      // Verify ownership
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this account'
        });
      }

      const status = whatsappService.getStatus(clientId);
      res.json({
        success: true,
        status
      });
    } catch (error) {
      console.error('Error getting status:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting status'
      });
    }
  }

  async logout(req, res) {
    try {
      const { clientId } = req.body;
      const userId = req.user.id;

      if (!clientId) {
        return res.status(400).json({
          success: false,
          message: 'clientId is required'
        });
      }

      // Verify ownership
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to logout from this account'
        });
      }

      await whatsappService.logout(clientId);

      // Update in DB
      await accountService.updateAuthStatus(clientId, false, null);

      res.json({
        success: true,
        message: 'WhatsApp session closed successfully'
      });
    } catch (error) {
      console.error('Error in logout:', error);
      res.status(500).json({
        success: false,
        message: 'Error closing session'
      });
    }
  }
}

module.exports = new AuthController();
