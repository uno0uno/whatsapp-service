const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const whatsappRoutes = require('./whatsapp.routes');
const accountsRoutes = require('./accounts.routes');

// Rutas principales
router.use('/auth', authRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/accounts', accountsRoutes);

// Ruta de health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
