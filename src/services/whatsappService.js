const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const EventEmitter = require('events');

/**
 * Servicio de WhatsApp que soporta múltiples cuentas simultáneas
 * Cada cuenta tiene su propio Client y estado independiente
 */
class WhatsAppService extends EventEmitter {
  constructor() {
    super();
    // Map de clientId -> { client, qrCode, isReady, isInitialized, phoneNumber }
    this.clients = new Map();
  }

  /**
   * Inicializa un cliente de WhatsApp para un clientId específico
   * @param {string} clientId - ID único del cliente
   * @param {object} options - Opciones adicionales
   */
  async initializeClient(clientId, options = {}) {
    if (this.clients.has(clientId)) {
      const clientData = this.clients.get(clientId);
      if (clientData.isInitialized) {
        console.log(`Cliente ${clientId} ya está inicializado`);
        return clientData;
      }
    }

    console.log(`[${clientId}] Inicializando con LocalAuth`);

    // Usar solo LocalAuth con volumen Docker
    const authStrategy = new LocalAuth({
      clientId: clientId,
      dataPath: './whatsapp-session'
    });

    const client = new Client({
      authStrategy: authStrategy,
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    // Datos del cliente
    const clientData = {
      client: client,
      authStrategy: authStrategy,
      qrCode: null,
      isReady: false,
      isInitialized: false,
      phoneNumber: null,
      lastQRAt: null,
      authenticatedAt: null
    };

    // Evento: QR Code generado
    client.on('qr', async (qr) => {
      try {
        clientData.qrCode = await qrcode.toDataURL(qr);
        clientData.lastQRAt = new Date();
        console.log(`[${clientId}] QR Code generado`);

        // Emitir evento para SSE con el clientId
        this.emit('qr', { clientId, qrCode: clientData.qrCode });
      } catch (err) {
        console.error(`[${clientId}] Error generando QR:`, err);
      }
    });

    // Evento: Cliente listo
    client.on('ready', async () => {
      clientData.isReady = true;
      clientData.qrCode = null;
      clientData.authenticatedAt = new Date();

      // Obtener información del número
      try {
        const info = client.info;
        if (info && info.wid) {
          clientData.phoneNumber = info.wid.user;
          console.log(`[${clientId}] ✅ Listo - ${clientData.phoneNumber}`);
        }
      } catch (err) {
        console.error(`[${clientId}] Error obteniendo número:`, err);
      }

      // Emitir evento de que está listo
      this.emit('ready', {
        clientId,
        phoneNumber: clientData.phoneNumber,
        authenticatedAt: clientData.authenticatedAt
      });
    });

    // Evento: Autenticado
    client.on('authenticated', () => {
      console.log(`[${clientId}] WhatsApp autenticado correctamente`);
    });

    // Evento: Fallo en autenticación
    client.on('auth_failure', (msg) => {
      console.error(`[${clientId}] Fallo en autenticación:`, msg);
      clientData.isReady = false;
      this.emit('auth_failure', { clientId, error: msg });
    });

    // Evento: Desconectado
    client.on('disconnected', (reason) => {
      console.log(`[${clientId}] WhatsApp desconectado:`, reason);
      clientData.isReady = false;
      clientData.qrCode = null;
      this.emit('disconnected', { clientId, reason });
    });

    // Guardar en el Map
    this.clients.set(clientId, clientData);

    // Inicializar el cliente
    console.log(`[${clientId}] 🚀 Iniciando cliente WhatsApp...`);

    try {
      await client.initialize();
      console.log(`[${clientId}] ✅ Cliente inicializado exitosamente`);
      clientData.isInitialized = true;
    } catch (error) {
      console.error(`[${clientId}] ❌ Error en inicialización:`, error);
      throw error;
    }

    return clientData;
  }

  /**
   * Envía un mensaje usando un cliente específico
   * @param {string} clientId - ID del cliente
   * @param {string} number - Número de teléfono destino
   * @param {string} message - Mensaje a enviar
   */
  async sendMessage(clientId, number, message) {
    const clientData = this.clients.get(clientId);

    if (!clientData) {
      throw new Error(`Cliente ${clientId} no existe. Debes inicializarlo primero.`);
    }

    if (!clientData.isReady) {
      throw new Error(`Cliente ${clientId} no está listo. Escanea el QR code primero.`);
    }

    try {
      // Formatear número (agregar @c.us si no lo tiene)
      const formattedNumber = number.includes('@c.us')
        ? number
        : `${number.replace(/[^0-9]/g, '')}@c.us`;

      const chat = await clientData.client.sendMessage(formattedNumber, message);

      console.log(`[${clientId}] Mensaje enviado a ${formattedNumber}`);

      return {
        success: true,
        messageId: chat.id._serialized,
        to: formattedNumber,
        clientId: clientId
      };
    } catch (error) {
      console.error(`[${clientId}] Error enviando mensaje:`, error);
      throw new Error(`Error al enviar mensaje: ${error.message}`);
    }
  }

  /**
   * Obtiene el QR Code de un cliente específico
   * @param {string} clientId - ID del cliente
   */
  getQRCode(clientId) {
    const clientData = this.clients.get(clientId);
    if (!clientData) {
      throw new Error(`Cliente ${clientId} no existe`);
    }
    return clientData.qrCode;
  }

  /**
   * Obtiene el estado de un cliente específico
   * @param {string} clientId - ID del cliente
   */
  getStatus(clientId) {
    const clientData = this.clients.get(clientId);

    if (!clientData) {
      return {
        exists: false,
        message: 'Cliente no existe'
      };
    }

    return {
      exists: true,
      isReady: clientData.isReady,
      isInitialized: clientData.isInitialized,
      hasQR: !!clientData.qrCode,
      phoneNumber: clientData.phoneNumber,
      lastQRAt: clientData.lastQRAt,
      authenticatedAt: clientData.authenticatedAt
    };
  }

  /**
   * Obtiene el estado de todos los clientes
   */
  getAllStatus() {
    const statuses = {};
    for (const [clientId, clientData] of this.clients.entries()) {
      statuses[clientId] = {
        isReady: clientData.isReady,
        isInitialized: clientData.isInitialized,
        hasQR: !!clientData.qrCode,
        phoneNumber: clientData.phoneNumber,
        lastQRAt: clientData.lastQRAt,
        authenticatedAt: clientData.authenticatedAt
      };
    }
    return statuses;
  }

  /**
   * Lista todos los clientId registrados
   */
  listClients() {
    return Array.from(this.clients.keys());
  }

  /**
   * Cierra sesión de un cliente específico
   * @param {string} clientId - ID del cliente
   */
  async logout(clientId) {
    const clientData = this.clients.get(clientId);

    if (!clientData) {
      throw new Error(`Cliente ${clientId} no existe`);
    }

    if (clientData.client) {
      await clientData.client.logout();
      clientData.isReady = false;
      clientData.qrCode = null;
      clientData.phoneNumber = null;
      console.log(`[${clientId}] Sesión cerrada`);
    }
  }

  /**
   * Destruye completamente un cliente
   * @param {string} clientId - ID del cliente
   */
  async destroyClient(clientId) {
    const clientData = this.clients.get(clientId);

    if (!clientData) {
      throw new Error(`Cliente ${clientId} no existe`);
    }

    if (clientData.client) {
      await clientData.client.destroy();
      console.log(`[${clientId}] Cliente destruido`);
    }

    this.clients.delete(clientId);
  }

  /**
   * Verifica si un cliente existe
   * @param {string} clientId - ID del cliente
   */
  hasClient(clientId) {
    return this.clients.has(clientId);
  }
}

// Exportar la clase (no una instancia singleton)
// Ahora necesitaremos crear instancias o usar un patrón de gestión
module.exports = new WhatsAppService();
