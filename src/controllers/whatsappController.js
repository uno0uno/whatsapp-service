const whatsappService = require('../services/whatsappService');
const messageService = require('../services/messageService');
const accountService = require('../services/accountService');

class WhatsAppController {
  async sendMessage(req, res) {
    try {
      const { clientId, number, message } = req.body;
      const userId = req.user.id;

      if (!clientId) {
        return res.status(400).json({
          success: false,
          message: 'clientId is required'
        });
      }

      if (!number || !message) {
        return res.status(400).json({
          success: false,
          message: 'Number and message are required'
        });
      }

      // Verify ownership
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to use this account'
        });
      }

      // Validate that WhatsApp is ready
      const status = whatsappService.getStatus(clientId);
      if (!status.exists) {
        return res.status(404).json({
          success: false,
          message: 'Client does not exist. You must initialize it first.'
        });
      }

      if (!status.isReady) {
        return res.status(503).json({
          success: false,
          message: 'WhatsApp is not ready. Scan the QR code first.',
          status
        });
      }

      const result = await whatsappService.sendMessage(clientId, number, message);

      // Get account_id for logging
      const account = await accountService.getAccountByClientId(clientId);

      // Save to database
      await messageService.logMessage({
        userId,
        accountId: account.id,
        phoneNumber: number,
        message,
        messageId: result.messageId,
        status: 'sent'
      });

      res.json({
        success: true,
        message: 'Message sent successfully',
        data: result
      });
    } catch (error) {
      console.error('Error sending message:', error);

      // Save error to database
      try {
        const account = await accountService.getAccountByClientId(req.body.clientId);
        await messageService.logMessage({
          userId: req.user.id,
          accountId: account ? account.id : null,
          phoneNumber: req.body.number,
          message: req.body.message,
          messageId: null,
          status: 'failed',
          errorMessage: error.message
        });
      } catch (logError) {
        console.error('Error logging message:', logError);
      }

      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async sendBulkMessages(req, res) {
    try {
      const { clientId, messages } = req.body;
      const userId = req.user.id;

      if (!clientId) {
        return res.status(400).json({
          success: false,
          message: 'clientId is required'
        });
      }

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({
          success: false,
          message: 'An array of messages with format is required: [{number, message}]'
        });
      }

      // Verify ownership
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to use this account'
        });
      }

      // Validate that WhatsApp is ready
      const status = whatsappService.getStatus(clientId);
      if (!status.exists) {
        return res.status(404).json({
          success: false,
          message: 'Client does not exist. You must initialize it first.'
        });
      }

      if (!status.isReady) {
        return res.status(503).json({
          success: false,
          message: 'WhatsApp is not ready. Scan the QR code first.',
          status
        });
      }

      const results = [];
      const errors = [];

      // Get account_id for logging
      const account = await accountService.getAccountByClientId(clientId);

      for (const msg of messages) {
        try {
          if (!msg.number || !msg.message) {
            errors.push({
              message: msg,
              error: 'Number or message missing'
            });
            continue;
          }

          const result = await whatsappService.sendMessage(clientId, msg.number, msg.message);
          results.push(result);

          // Save to database
          await messageService.logMessage({
            userId,
            accountId: account.id,
            phoneNumber: msg.number,
            message: msg.message,
            messageId: result.messageId,
            status: 'sent'
          });

          // Delay between messages to avoid blocking
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          errors.push({
            number: msg.number,
            error: error.message
          });

          // Log error
          await messageService.logMessage({
            userId,
            accountId: account.id,
            phoneNumber: msg.number,
            message: msg.message,
            messageId: null,
            status: 'failed',
            errorMessage: error.message
          });
        }
      }

      res.json({
        success: true,
        message: `${results.length} messages sent, ${errors.length} errors`,
        data: {
          sent: results,
          errors
        }
      });
    } catch (error) {
      console.error('Error sending bulk messages:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new WhatsAppController();
