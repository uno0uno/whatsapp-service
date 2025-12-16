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

  // Server-Sent Events for QR Code
  async getQRStream(req, res) {
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

      // Check that client exists BEFORE setting up SSE
      const status = whatsappService.getStatus(clientId);

      if (!status.exists) {
        return res.status(404).json({
          success: false,
          message: 'Client does not exist. You must initialize it first.',
          clientId: clientId
        });
      }

      // Configure headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // Send initial message
      res.write(`data: ${JSON.stringify({
        type: 'connected',
        message: `Connected to QR stream for ${clientId}`
      })}\n\n`);

      // If already ready, send message and close
      if (status.isReady) {
        res.write(`data: ${JSON.stringify({
          type: 'ready',
          message: 'WhatsApp is already authenticated',
          phoneNumber: status.phoneNumber
        })}\n\n`);
        return res.end();
      }

      // If QR code is already available, send it immediately
      const currentQR = whatsappService.getQRCode(clientId);
      if (currentQR) {
        res.write(`data: ${JSON.stringify({
          type: 'qr',
          qrCode: currentQR,
          message: 'QR Code available'
        })}\n\n`);
      }

      // Listener for new QR codes - filter by clientId
      const onQR = (data) => {
        // Only send if it's for this clientId
        if (data.clientId === clientId) {
          res.write(`data: ${JSON.stringify({
            type: 'qr',
            qrCode: data.qrCode,
            message: 'New QR Code generated'
          })}\n\n`);

          // Update timestamp in DB
          accountService.updateLastQR(clientId).catch(err => {
            console.error('Error updating lastQR:', err);
          });
        }
      };

      // Listener for when ready - filter by clientId
      const onReady = async (data) => {
        // Only send if it's for this clientId
        if (data.clientId === clientId) {
          res.write(`data: ${JSON.stringify({
            type: 'ready',
            message: 'WhatsApp authenticated successfully',
            phoneNumber: data.phoneNumber
          })}\n\n`);

          // Update in DB
          try {
            await accountService.updateAuthStatus(clientId, true, data.phoneNumber);
          } catch (err) {
            console.error('Error updating auth status:', err);
          }

          res.end();
        }
      };

      // Register listeners
      whatsappService.on('qr', onQR);
      whatsappService.on('ready', onReady);

      // Heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        res.write(':heartbeat\n\n');
      }, 30000);

      // Cleanup when client disconnects
      req.on('close', () => {
        clearInterval(heartbeat);
        whatsappService.removeListener('qr', onQR);
        whatsappService.removeListener('ready', onReady);
        console.log(`[${clientId}] SSE client disconnected`);
      });
    } catch (error) {
      console.error('Error in SSE:', error);
      res.status(500).json({
        success: false,
        message: 'Error establishing SSE connection'
      });
    }
  }
}

module.exports = new AuthController();
