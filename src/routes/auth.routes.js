const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/auth');
const authSSEMiddleware = require('../middlewares/authSSE');

// Public routes
router.post('/login', authController.login);

// Protected routes
router.get('/qr', authMiddleware, authController.getQRCode);
router.get('/qr-stream', authSSEMiddleware, authController.getQRStream); // SSE with query param
router.get('/status', authMiddleware, authController.getStatus);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
