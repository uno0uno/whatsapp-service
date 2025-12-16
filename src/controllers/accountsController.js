const accountService = require('../services/accountService');
const whatsappService = require('../services/whatsappService');

/**
 * Controller to manage WhatsApp accounts
 */
class AccountsController {
  /**
   * Creates a new WhatsApp account for the authenticated user
   * POST /api/accounts
   * Body: { accountName: string }
   */
  async createAccount(req, res) {
    try {
      const { accountName } = req.body;
      const userId = req.user.id;

      if (!accountName) {
        return res.status(400).json({
          success: false,
          message: 'accountName is required'
        });
      }

      // Create account in database
      const account = await accountService.createAccount(userId, accountName);

      // Initialize WhatsApp client in background (without await)
      whatsappService.initializeClient(account.client_id).catch(error => {
        console.error(`[${account.client_id}] Error in background initialization:`, error);
      });

      res.status(201).json({
        success: true,
        message: 'Account created successfully. Initialization is being processed.',
        data: {
          id: account.id,
          clientId: account.client_id,
          accountName: account.account_name,
          isActive: account.is_active,
          createdAt: account.created_at
        }
      });
    } catch (error) {
      console.error('Error creating account:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating account',
        error: error.message
      });
    }
  }

  /**
   * Lists all accounts of the authenticated user
   * GET /api/accounts
   */
  async listAccounts(req, res) {
    try {
      const userId = req.user.id;
      const accounts = await accountService.getAccountsByUser(userId);

      // Add current WhatsApp status
      const accountsWithStatus = accounts.map(account => {
        const status = whatsappService.getStatus(account.client_id);
        return {
          id: account.id,
          clientId: account.client_id,
          accountName: account.account_name,
          phoneNumber: account.phone_number,
          isActive: account.is_active,
          isReady: status.isReady || false,
          hasQR: status.hasQR || false,
          createdAt: account.created_at,
          authenticatedAt: account.authenticated_at
        };
      });

      res.json({
        success: true,
        data: accountsWithStatus
      });
    } catch (error) {
      console.error('Error listing accounts:', error);
      res.status(500).json({
        success: false,
        message: 'Error listing accounts',
        error: error.message
      });
    }
  }

  /**
   * Gets the status of a specific account
   * GET /api/accounts/:clientId/status
   */
  async getAccountStatus(req, res) {
    try {
      const { clientId } = req.params;
      const userId = req.user.id;

      // Verify ownership
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this account'
        });
      }

      // Get status from DB
      const account = await accountService.getAccountByClientId(clientId);
      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Account not found'
        });
      }

      // Get WhatsApp status
      const whatsappStatus = whatsappService.getStatus(clientId);

      res.json({
        success: true,
        data: {
          clientId: account.client_id,
          accountName: account.account_name,
          phoneNumber: account.phone_number,
          isActive: account.is_active,
          whatsappStatus: whatsappStatus
        }
      });
    } catch (error) {
      console.error('Error getting status:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting status',
        error: error.message
      });
    }
  }

  /**
   * Gets statistics for an account
   * GET /api/accounts/:clientId/stats
   */
  async getAccountStats(req, res) {
    try {
      const { clientId } = req.params;
      const userId = req.user.id;

      // Verify ownership
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this account'
        });
      }

      const stats = await accountService.getAccountStats(clientId);

      if (!stats) {
        return res.status(404).json({
          success: false,
          message: 'Account not found'
        });
      }

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting statistics',
        error: error.message
      });
    }
  }

  /**
   * Updates the name of an account
   * PATCH /api/accounts/:clientId
   * Body: { accountName: string }
   */
  async updateAccountName(req, res) {
    try {
      const { clientId } = req.params;
      const { accountName } = req.body;
      const userId = req.user.id;

      // Verify ownership
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to modify this account'
        });
      }

      if (!accountName) {
        return res.status(400).json({
          success: false,
          message: 'accountName is required'
        });
      }

      const updated = await accountService.updateAccountName(clientId, accountName);

      res.json({
        success: true,
        message: 'Name updated',
        data: updated
      });
    } catch (error) {
      console.error('Error updating name:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating name',
        error: error.message
      });
    }
  }

  /**
   * Deletes (deactivates) an account
   * DELETE /api/accounts/:clientId
   */
  async deleteAccount(req, res) {
    try {
      const { clientId } = req.params;
      const userId = req.user.id;

      // Verify ownership
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this account'
        });
      }

      // Close WhatsApp session if active
      if (whatsappService.hasClient(clientId)) {
        await whatsappService.logout(clientId);
        await whatsappService.destroyClient(clientId);
      }

      // Deactivate in DB
      await accountService.deleteAccount(clientId, false);

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting account',
        error: error.message
      });
    }
  }

  /**
   * Initializes/restarts an account (generates new QR)
   * POST /api/accounts/:clientId/initialize
   */
  async initializeAccount(req, res) {
    try {
      const { clientId } = req.params;
      const userId = req.user.id;

      // Verify ownership
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to initialize this account'
        });
      }

      // Initialize client in background (without await)
      // Initialization can take 30-60 seconds
      whatsappService.initializeClient(clientId).catch(error => {
        console.error(`[${clientId}] Error in background initialization:`, error);
      });

      // Respond immediately
      res.json({
        success: true,
        message: 'Initialization started. Use /status or /qr-stream to monitor progress.',
        data: {
          clientId,
          status: 'initializing'
        }
      });
    } catch (error) {
      console.error('Error initializing account:', error);
      res.status(500).json({
        success: false,
        message: 'Error initializing account',
        error: error.message
      });
    }
  }
}

module.exports = new AccountsController();
