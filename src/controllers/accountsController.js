const accountService = require('../services/accountService');
const whatsappService = require('../services/whatsappService');

/**
 * Controller para gestionar cuentas de WhatsApp
 */
class AccountsController {
  /**
   * Crea una nueva cuenta de WhatsApp para el usuario autenticado
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
          message: 'accountName es requerido'
        });
      }

      // Crear cuenta en la base de datos
      const account = await accountService.createAccount(userId, accountName);

      // Inicializar el cliente de WhatsApp en background (sin await)
      whatsappService.initializeClient(account.client_id).catch(error => {
        console.error(`[${account.client_id}] Error en inicialización background:`, error);
      });

      res.status(201).json({
        success: true,
        message: 'Cuenta creada exitosamente. La inicialización se está procesando.',
        data: {
          id: account.id,
          clientId: account.client_id,
          accountName: account.account_name,
          isActive: account.is_active,
          createdAt: account.created_at
        }
      });
    } catch (error) {
      console.error('Error creando cuenta:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear cuenta',
        error: error.message
      });
    }
  }

  /**
   * Lista todas las cuentas del usuario autenticado
   * GET /api/accounts
   */
  async listAccounts(req, res) {
    try {
      const userId = req.user.id;
      const accounts = await accountService.getAccountsByUser(userId);

      // Agregar estado actual de WhatsApp
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
      console.error('Error listando cuentas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al listar cuentas',
        error: error.message
      });
    }
  }

  /**
   * Obtiene el estado de una cuenta específica
   * GET /api/accounts/:clientId/status
   */
  async getAccountStatus(req, res) {
    try {
      const { clientId } = req.params;
      const userId = req.user.id;

      // Verificar propiedad
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a esta cuenta'
        });
      }

      // Obtener estado de la BD
      const account = await accountService.getAccountByClientId(clientId);
      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Cuenta no encontrada'
        });
      }

      // Obtener estado de WhatsApp
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
      console.error('Error obteniendo estado:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estado',
        error: error.message
      });
    }
  }

  /**
   * Obtiene estadísticas de una cuenta
   * GET /api/accounts/:clientId/stats
   */
  async getAccountStats(req, res) {
    try {
      const { clientId } = req.params;
      const userId = req.user.id;

      // Verificar propiedad
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a esta cuenta'
        });
      }

      const stats = await accountService.getAccountStats(clientId);

      if (!stats) {
        return res.status(404).json({
          success: false,
          message: 'Cuenta no encontrada'
        });
      }

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: error.message
      });
    }
  }

  /**
   * Actualiza el nombre de una cuenta
   * PATCH /api/accounts/:clientId
   * Body: { accountName: string }
   */
  async updateAccountName(req, res) {
    try {
      const { clientId } = req.params;
      const { accountName } = req.body;
      const userId = req.user.id;

      // Verificar propiedad
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar esta cuenta'
        });
      }

      if (!accountName) {
        return res.status(400).json({
          success: false,
          message: 'accountName es requerido'
        });
      }

      const updated = await accountService.updateAccountName(clientId, accountName);

      res.json({
        success: true,
        message: 'Nombre actualizado',
        data: updated
      });
    } catch (error) {
      console.error('Error actualizando nombre:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar nombre',
        error: error.message
      });
    }
  }

  /**
   * Elimina (desactiva) una cuenta
   * DELETE /api/accounts/:clientId
   */
  async deleteAccount(req, res) {
    try {
      const { clientId } = req.params;
      const userId = req.user.id;

      // Verificar propiedad
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para eliminar esta cuenta'
        });
      }

      // Cerrar sesión de WhatsApp si está activo
      if (whatsappService.hasClient(clientId)) {
        await whatsappService.logout(clientId);
        await whatsappService.destroyClient(clientId);
      }

      // Desactivar en la BD
      await accountService.deleteAccount(clientId, false);

      res.json({
        success: true,
        message: 'Cuenta eliminada exitosamente'
      });
    } catch (error) {
      console.error('Error eliminando cuenta:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar cuenta',
        error: error.message
      });
    }
  }

  /**
   * Inicializa/reinicia una cuenta (genera nuevo QR)
   * POST /api/accounts/:clientId/initialize
   */
  async initializeAccount(req, res) {
    try {
      const { clientId } = req.params;
      const userId = req.user.id;

      // Verificar propiedad
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para inicializar esta cuenta'
        });
      }

      // Inicializar el cliente en background (sin await)
      // La inicialización puede tardar 30-60 segundos
      whatsappService.initializeClient(clientId).catch(error => {
        console.error(`[${clientId}] Error en inicialización background:`, error);
      });

      // Responder inmediatamente
      res.json({
        success: true,
        message: 'Inicialización iniciada. Usa /status o /qr-stream para monitorear el progreso.',
        data: {
          clientId,
          status: 'initializing'
        }
      });
    } catch (error) {
      console.error('Error inicializando cuenta:', error);
      res.status(500).json({
        success: false,
        message: 'Error al inicializar cuenta',
        error: error.message
      });
    }
  }
}

module.exports = new AccountsController();
