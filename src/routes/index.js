const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const whatsappRoutes = require('./whatsapp.routes');
const accountsRoutes = require('./accounts.routes');

// Main routes
router.use('/auth', authRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/accounts', accountsRoutes);

// Health check route
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API working correctly',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
