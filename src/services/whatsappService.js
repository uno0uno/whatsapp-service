const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const EventEmitter = require('events');

/**
 * WhatsApp service supporting multiple simultaneous accounts
 * Each account has its own Client and independent state
 */
class WhatsAppService extends EventEmitter {
  constructor() {
    super();
    // Map of clientId -> { client, qrCode, isReady, isInitialized, phoneNumber }
    this.clients = new Map();
  }

  /**
   * Initializes a WhatsApp client for a specific clientId
   * @param {string} clientId - Unique client ID
   * @param {object} options - Additional options
   */
  async initializeClient(clientId, options = {}) {
    if (this.clients.has(clientId)) {
      const clientData = this.clients.get(clientId);
      if (clientData.isInitialized) {
        console.log(`Client ${clientId} is already initialized`);
        return clientData;
      }
    }

    console.log(`[${clientId}] Initializing with LocalAuth`);

    // Using only LocalAuth with Docker volume
    // Use absolute path to ensure consistency
    const sessionPath = process.env.WHATSAPP_SESSION_PATH || './whatsapp-session';
    const authStrategy = new LocalAuth({
      clientId: clientId,
      dataPath: sessionPath
    });

    console.log(`[${clientId}] Session path: ${sessionPath}`);

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

    // Client data
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

    // Event: QR Code generated
    client.on('qr', async (qr) => {
      try {
        clientData.qrCode = await qrcode.toDataURL(qr);
        clientData.lastQRAt = new Date();
        console.log(`[${clientId}] QR Code generated`);

        // Emit event for SSE with clientId
        this.emit('qr', { clientId, qrCode: clientData.qrCode });
      } catch (err) {
        console.error(`[${clientId}] Error generating QR:`, err);
      }
    });

    // Event: Client ready
    client.on('ready', async () => {
      clientData.isReady = true;
      clientData.qrCode = null;
      clientData.authenticatedAt = new Date();

      // Get phone number information
      try {
        const info = client.info;
        if (info && info.wid) {
          clientData.phoneNumber = info.wid.user;
          console.log(`[${clientId}] ✅ Ready - ${clientData.phoneNumber}`);
        }
      } catch (err) {
        console.error(`[${clientId}] Error getting phone number:`, err);
      }

      // Emit ready event
      this.emit('ready', {
        clientId,
        phoneNumber: clientData.phoneNumber,
        authenticatedAt: clientData.authenticatedAt
      });
    });

    // Event: Authenticated
    client.on('authenticated', () => {
      console.log(`[${clientId}] WhatsApp authenticated successfully`);
    });

    // Event: Authentication failure
    client.on('auth_failure', (msg) => {
      console.error(`[${clientId}] Authentication failed:`, msg);
      clientData.isReady = false;
      this.emit('auth_failure', { clientId, error: msg });
    });

    // Event: Disconnected
    client.on('disconnected', (reason) => {
      console.log(`[${clientId}] WhatsApp disconnected:`, reason);
      clientData.isReady = false;
      clientData.qrCode = null;
      this.emit('disconnected', { clientId, reason });
    });

    // Save to Map
    this.clients.set(clientId, clientData);

    // Initialize the client
    console.log(`[${clientId}] 🚀 Starting WhatsApp client...`);

    try {
      await client.initialize();
      console.log(`[${clientId}] ✅ Client initialized successfully`);
      clientData.isInitialized = true;
    } catch (error) {
      console.error(`[${clientId}] ❌ Initialization error:`, error);
      throw error;
    }

    return clientData;
  }

  /**
   * Sends a message using a specific client
   * @param {string} clientId - Client ID
   * @param {string} number - Destination phone number
   * @param {string} message - Message to send
   */
  async sendMessage(clientId, number, message) {
    const clientData = this.clients.get(clientId);

    if (!clientData) {
      throw new Error(`Client ${clientId} does not exist. You must initialize it first.`);
    }

    if (!clientData.isReady) {
      throw new Error(`Client ${clientId} is not ready. Scan the QR code first.`);
    }

    try {
      // Format number (add @c.us if not present)
      const formattedNumber = number.includes('@c.us')
        ? number
        : `${number.replace(/[^0-9]/g, '')}@c.us`;

      const chat = await clientData.client.sendMessage(formattedNumber, message);

      console.log(`[${clientId}] Message sent to ${formattedNumber}`);

      return {
        success: true,
        messageId: chat.id._serialized,
        to: formattedNumber,
        clientId: clientId
      };
    } catch (error) {
      console.error(`[${clientId}] Error sending message:`, error);
      throw new Error(`Error sending message: ${error.message}`);
    }
  }

  /**
   * Gets the QR Code of a specific client
   * @param {string} clientId - Client ID
   */
  getQRCode(clientId) {
    const clientData = this.clients.get(clientId);
    if (!clientData) {
      throw new Error(`Client ${clientId} does not exist`);
    }
    return clientData.qrCode;
  }

  /**
   * Gets the status of a specific client
   * @param {string} clientId - Client ID
   */
  getStatus(clientId) {
    const clientData = this.clients.get(clientId);

    if (!clientData) {
      return {
        exists: false,
        message: 'Client does not exist'
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
   * Gets the status of all clients
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
   * Lists all registered clientIds
   */
  listClients() {
    return Array.from(this.clients.keys());
  }

  /**
   * Logs out from a specific client
   * @param {string} clientId - Client ID
   */
  async logout(clientId) {
    const clientData = this.clients.get(clientId);

    if (!clientData) {
      throw new Error(`Client ${clientId} does not exist`);
    }

    if (clientData.client) {
      await clientData.client.logout();
      clientData.isReady = false;
      clientData.qrCode = null;
      clientData.phoneNumber = null;
      console.log(`[${clientId}] Session logged out`);
    }
  }

  /**
   * Completely destroys a client
   * @param {string} clientId - Client ID
   */
  async destroyClient(clientId) {
    const clientData = this.clients.get(clientId);

    if (!clientData) {
      throw new Error(`Client ${clientId} does not exist`);
    }

    if (clientData.client) {
      await clientData.client.destroy();
      console.log(`[${clientId}] Client destroyed`);
    }

    this.clients.delete(clientId);
  }

  /**
   * Checks if a client exists
   * @param {string} clientId - Client ID
   */
  hasClient(clientId) {
    return this.clients.has(clientId);
  }

  /**
   * Gets all chats for a specific client
   * @param {string} clientId - Client ID
   * @returns {Array} List of chats with their information
   */
  async getAllChats(clientId) {
    const clientData = this.clients.get(clientId);

    if (!clientData) {
      throw new Error(`Client ${clientId} does not exist`);
    }

    if (!clientData.isReady) {
      throw new Error(`Client ${clientId} is not ready`);
    }

    try {
      // Wait 3 seconds to ensure WhatsApp Web has fully loaded chats
      await new Promise(resolve => setTimeout(resolve, 3000));

      const chats = await clientData.client.getChats();

      // Format chat information - extract phone numbers
      const formattedChats = chats.map((chat) => {
        // Extract phone number from chat ID
        const phoneNumber = chat.id.user || chat.id._serialized.split('@')[0];

        return {
          phoneNumber: phoneNumber,
          name: chat.name || 'Unknown',
          isGroup: chat.isGroup,
          unreadCount: chat.unreadCount,
          timestamp: chat.timestamp
        };
      });

      // Sort by timestamp (most recent first)
      formattedChats.sort((a, b) => b.timestamp - a.timestamp);

      console.log(`[${clientId}] Retrieved ${formattedChats.length} chats`);
      return formattedChats;
    } catch (error) {
      console.error(`[${clientId}] Error getting chats:`, error);
      throw new Error(`Error getting chats: ${error.message}`);
    }
  }

  /**
   * Gets only chats with unread messages
   * @param {string} clientId - Client ID
   * @returns {Array} List of chats with unread messages
   */
  async getUnreadChats(clientId) {
    const clientData = this.clients.get(clientId);

    if (!clientData) {
      throw new Error(`Client ${clientId} does not exist`);
    }

    if (!clientData.isReady) {
      throw new Error(`Client ${clientId} is not ready`);
    }

    try {
      // Wait 3 seconds to ensure WhatsApp Web has fully loaded chats
      await new Promise(resolve => setTimeout(resolve, 3000));

      const chats = await clientData.client.getChats();

      // Filter only chats with unread messages
      const unreadChats = chats.filter(chat => chat.unreadCount > 0);

      // Format unread chats - extract phone number and last message
      const formattedChats = unreadChats.map((chat) => {
        // Extract phone number from chat ID
        const phoneNumber = chat.id.user || chat.id._serialized.split('@')[0];

        return {
          phoneNumber: phoneNumber,
          name: chat.name || 'Unknown',
          isGroup: chat.isGroup,
          unreadCount: chat.unreadCount,
          lastMessage: chat.lastMessage ? {
            body: chat.lastMessage.body,
            timestamp: chat.lastMessage.timestamp,
            fromMe: chat.lastMessage.fromMe
          } : null,
          timestamp: chat.timestamp
        };
      });

      // Sort by timestamp (most recent first)
      formattedChats.sort((a, b) => b.timestamp - a.timestamp);

      console.log(`[${clientId}] Retrieved ${formattedChats.length} unread chats`);
      return formattedChats;
    } catch (error) {
      console.error(`[${clientId}] Error getting unread chats:`, error);
      throw new Error(`Error getting unread chats: ${error.message}`);
    }
  }
}

// Export the class (not a singleton instance)
// Now we need to create instances or use a management pattern
module.exports = new WhatsAppService();
