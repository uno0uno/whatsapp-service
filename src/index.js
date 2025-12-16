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
    message: 'Error interno del servidor'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Inicializar servidor
const startServer = async () => {
  try {
    // Iniciar servidor Express
    app.listen(config.port, () => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║      WhatsApp Service API - Corriendo                 ║
║      (Modo Multi-Cuenta)                               ║
║                                                        ║
║      Puerto: ${config.port}                                     ║
║      Entorno: ${config.nodeEnv}                            ║
║                                                        ║
║      Endpoints principales:                            ║
║      POST /api/auth/login                              ║
║      POST /api/accounts (crear cuenta)                 ║
║      GET  /api/accounts (listar cuentas)               ║
║      POST /api/accounts/:id/initialize                 ║
║      GET  /api/auth/qr?clientId=...                    ║
║      GET  /api/auth/qr-stream?clientId=...             ║
║      GET  /api/auth/status?clientId=...                ║
║      POST /api/whatsapp/send                           ║
║      POST /api/whatsapp/send-bulk                      ║
║                                                        ║
║      ℹ️  Las cuentas de WhatsApp se inicializan        ║
║         bajo demanda mediante /api/accounts            ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
      `);
      console.log('✓ Servidor listo para gestionar múltiples cuentas de WhatsApp');
    });

  } catch (error) {
    console.error('Error iniciando el servidor:', error);
    process.exit(1);
  }
};

// Manejo de señales de terminación
process.on('SIGTERM', async () => {
  console.log('SIGTERM recibido. Cerrando servidor...');
  // Cerrar todas las sesiones de WhatsApp
  const clientIds = whatsappService.listClients();
  for (const clientId of clientIds) {
    try {
      await whatsappService.logout(clientId);
    } catch (error) {
      console.error(`Error cerrando ${clientId}:`, error.message);
    }
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT recibido. Cerrando servidor...');
  // Cerrar todas las sesiones de WhatsApp
  const clientIds = whatsappService.listClients();
  for (const clientId of clientIds) {
    try {
      await whatsappService.logout(clientId);
    } catch (error) {
      console.error(`Error cerrando ${clientId}:`, error.message);
    }
  }
  process.exit(0);
});

startServer();
