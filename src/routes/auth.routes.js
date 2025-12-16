const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/auth');
const authSSEMiddleware = require('../middlewares/authSSE');

// Rutas públicas
router.post('/login', authController.login);

// Rutas protegidas
router.get('/qr', authMiddleware, authController.getQRCode);
router.get('/qr-stream', authSSEMiddleware, authController.getQRStream); // SSE con query param
router.get('/status', authMiddleware, authController.getStatus);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
