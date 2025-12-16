const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');
const routes = require('./routes');
const whatsappService = require('./services/whatsappService');

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Routes
app.use('/api', routes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Initialize server
const startServer = async () => {
  try {
    // Start Express server
    app.listen(config.port, () => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║      WhatsApp Service API - Running                   ║
║      (Multi-Account Mode)                              ║
║                                                        ║
║      Port: ${config.port}                                       ║
║      Environment: ${config.nodeEnv}                         ║
║                                                        ║
║      Main Endpoints:                                   ║
║      POST /api/auth/login                              ║
║      POST /api/accounts (create account)               ║
║      GET  /api/accounts (list accounts)                ║
║      POST /api/accounts/:id/initialize                 ║
║      GET  /api/auth/qr?clientId=...                    ║
║      GET  /api/auth/qr-stream?clientId=...             ║
║      GET  /api/auth/status?clientId=...                ║
║      POST /api/whatsapp/send                           ║
║      POST /api/whatsapp/send-bulk                      ║
║                                                        ║
║      ℹ️  WhatsApp accounts are initialized             ║
║         on demand via /api/accounts                    ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
      `);
      console.log('✓ Server ready to manage multiple WhatsApp accounts');
    });

  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

// Handling termination signals
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down server...');
  // Close all WhatsApp sessions
  const clientIds = whatsappService.listClients();
  for (const clientId of clientIds) {
    try {
      await whatsappService.logout(clientId);
    } catch (error) {
      console.error(`Error closing ${clientId}:`, error.message);
    }
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down server...');
  // Close all WhatsApp sessions
  const clientIds = whatsappService.listClients();
  for (const clientId of clientIds) {
    try {
      await whatsappService.logout(clientId);
    } catch (error) {
      console.error(`Error closing ${clientId}:`, error.message);
    }
  }
  process.exit(0);
});

startServer();
