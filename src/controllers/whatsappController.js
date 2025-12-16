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
          message: 'clientId es requerido'
        });
      }

      if (!number || !message) {
        return res.status(400).json({
          success: false,
          message: 'Número y mensaje son requeridos'
        });
      }

      // Verificar propiedad
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para usar esta cuenta'
        });
      }

      // Validar que WhatsApp esté listo
      const status = whatsappService.getStatus(clientId);
      if (!status.exists) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no existe. Debes inicializarlo primero.'
        });
      }

      if (!status.isReady) {
        return res.status(503).json({
          success: false,
          message: 'WhatsApp no está listo. Escanea el QR code primero.',
          status
        });
      }

      const result = await whatsappService.sendMessage(clientId, number, message);

      // Obtener account_id para el log
      const account = await accountService.getAccountByClientId(clientId);

      // Guardar en base de datos
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
        message: 'Mensaje enviado correctamente',
        data: result
      });
    } catch (error) {
      console.error('Error enviando mensaje:', error);

      // Guardar error en base de datos
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
          message: 'clientId es requerido'
        });
      }

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere un array de mensajes con formato: [{number, message}]'
        });
      }

      // Verificar propiedad
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para usar esta cuenta'
        });
      }

      // Validar que WhatsApp esté listo
      const status = whatsappService.getStatus(clientId);
      if (!status.exists) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no existe. Debes inicializarlo primero.'
        });
      }

      if (!status.isReady) {
        return res.status(503).json({
          success: false,
          message: 'WhatsApp no está listo. Escanea el QR code primero.',
          status
        });
      }

      const results = [];
      const errors = [];

      // Obtener account_id para el log
      const account = await accountService.getAccountByClientId(clientId);

      for (const msg of messages) {
        try {
          if (!msg.number || !msg.message) {
            errors.push({
              message: msg,
              error: 'Número o mensaje faltante'
            });
            continue;
          }

          const result = await whatsappService.sendMessage(clientId, msg.number, msg.message);
          results.push(result);

          // Guardar en base de datos
          await messageService.logMessage({
            userId,
            accountId: account.id,
            phoneNumber: msg.number,
            message: msg.message,
            messageId: result.messageId,
            status: 'sent'
          });

          // Delay entre mensajes para evitar bloqueo
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
        message: `${results.length} mensajes enviados, ${errors.length} errores`,
        data: {
          sent: results,
          errors
        }
      });
    } catch (error) {
      console.error('Error enviando mensajes bulk:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new WhatsAppController();
