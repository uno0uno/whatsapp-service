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
          message: 'Usuario y contraseña son requeridos'
        });
      }

      // Buscar usuario en la base de datos
      const user = await userService.findByUsername(username);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // Verificar si el usuario está activo
      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          message: 'Usuario inactivo. Contacta al administrador.'
        });
      }

      // Verificar contraseña
      const isPasswordValid = await userService.verifyPassword(password, user.password_hash);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // Actualizar último login
      await userService.updateLastLogin(user.id);

      // Generar token JWT
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
      console.error('Error en login:', error);
      res.status(500).json({
        success: false,
        message: 'Error en el servidor'
      });
    }
  }

  async register(req, res) {
    try {
      const { username, email, password, fullName } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Usuario y contraseña son requeridos'
        });
      }

      // Crear usuario
      const user = await userService.createUser({
        username,
        email,
        password,
        fullName,
        role: 'user'
      });

      res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Error en registro:', error);

      if (error.message === 'Usuario o email ya existe') {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error en el servidor'
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
          message: 'clientId es requerido como query parameter'
        });
      }

      // Verificar propiedad
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a esta cuenta'
        });
      }

      const qrCode = whatsappService.getQRCode(clientId);
      const status = whatsappService.getStatus(clientId);

      if (!status.exists) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no existe. Debes inicializarlo primero.'
        });
      }

      if (!qrCode && status.isReady) {
        return res.json({
          success: true,
          message: 'WhatsApp ya está autenticado',
          status
        });
      }

      if (!qrCode) {
        return res.status(404).json({
          success: false,
          message: 'QR Code no disponible. Espera un momento e intenta de nuevo.',
          status
        });
      }

      res.json({
        success: true,
        qrCode,
        message: 'Escanea este QR code con WhatsApp'
      });
    } catch (error) {
      console.error('Error obteniendo QR:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener QR code'
      });
    }
  }

  async getStatus(req, res) {
    try {
      const { clientId } = req.query;
      const userId = req.user.id;

      // Si no se proporciona clientId, devolver el estado de todas las cuentas del usuario
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

      // Verificar propiedad
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a esta cuenta'
        });
      }

      const status = whatsappService.getStatus(clientId);
      res.json({
        success: true,
        status
      });
    } catch (error) {
      console.error('Error obteniendo status:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener status'
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
          message: 'clientId es requerido'
        });
      }

      // Verificar propiedad
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para cerrar sesión de esta cuenta'
        });
      }

      await whatsappService.logout(clientId);

      // Actualizar en la BD
      await accountService.updateAuthStatus(clientId, false, null);

      res.json({
        success: true,
        message: 'Sesión de WhatsApp cerrada correctamente'
      });
    } catch (error) {
      console.error('Error en logout:', error);
      res.status(500).json({
        success: false,
        message: 'Error al cerrar sesión'
      });
    }
  }

  // Server-Sent Events para QR Code
  async getQRStream(req, res) {
    try {
      const { clientId } = req.query;
      const userId = req.user.id;

      if (!clientId) {
        return res.status(400).json({
          success: false,
          message: 'clientId es requerido como query parameter'
        });
      }

      // Verificar propiedad
      const isOwner = await accountService.isOwner(userId, clientId);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a esta cuenta'
        });
      }

      // Verificar que el cliente exista ANTES de configurar SSE
      const status = whatsappService.getStatus(clientId);

      if (!status.exists) {
        return res.status(404).json({
          success: false,
          message: 'Cliente no existe. Debes inicializarlo primero.',
          clientId: clientId
        });
      }

      // Configurar headers para SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // Enviar mensaje inicial
      res.write(`data: ${JSON.stringify({
        type: 'connected',
        message: `Conectado al stream de QR para ${clientId}`
      })}\n\n`);

      // Si ya está listo, enviar mensaje y cerrar
      if (status.isReady) {
        res.write(`data: ${JSON.stringify({
          type: 'ready',
          message: 'WhatsApp ya está autenticado',
          phoneNumber: status.phoneNumber
        })}\n\n`);
        return res.end();
      }

      // Si ya hay un QR code disponible, enviarlo inmediatamente
      const currentQR = whatsappService.getQRCode(clientId);
      if (currentQR) {
        res.write(`data: ${JSON.stringify({
          type: 'qr',
          qrCode: currentQR,
          message: 'QR Code disponible'
        })}\n\n`);
      }

      // Listener para nuevos QR codes - filtrar por clientId
      const onQR = (data) => {
        // Solo enviar si es para este clientId
        if (data.clientId === clientId) {
          res.write(`data: ${JSON.stringify({
            type: 'qr',
            qrCode: data.qrCode,
            message: 'Nuevo QR Code generado'
          })}\n\n`);

          // Actualizar timestamp en BD
          accountService.updateLastQR(clientId).catch(err => {
            console.error('Error actualizando lastQR:', err);
          });
        }
      };

      // Listener para cuando está listo - filtrar por clientId
      const onReady = async (data) => {
        // Solo enviar si es para este clientId
        if (data.clientId === clientId) {
          res.write(`data: ${JSON.stringify({
            type: 'ready',
            message: 'WhatsApp autenticado correctamente',
            phoneNumber: data.phoneNumber
          })}\n\n`);

          // Actualizar en la BD
          try {
            await accountService.updateAuthStatus(clientId, true, data.phoneNumber);
          } catch (err) {
            console.error('Error actualizando auth status:', err);
          }

          res.end();
        }
      };

      // Registrar listeners
      whatsappService.on('qr', onQR);
      whatsappService.on('ready', onReady);

      // Heartbeat cada 30 segundos
      const heartbeat = setInterval(() => {
        res.write(':heartbeat\n\n');
      }, 30000);

      // Cleanup cuando el cliente se desconecta
      req.on('close', () => {
        clearInterval(heartbeat);
        whatsappService.removeListener('qr', onQR);
        whatsappService.removeListener('ready', onReady);
        console.log(`[${clientId}] Cliente SSE desconectado`);
      });
    } catch (error) {
      console.error('Error en SSE:', error);
      res.status(500).json({
        success: false,
        message: 'Error al establecer conexión SSE'
      });
    }
  }
}

module.exports = new AuthController();
