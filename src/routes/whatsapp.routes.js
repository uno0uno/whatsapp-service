const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const authMiddleware = require('../middlewares/auth');

// All routes protected with authentication

// Send messages
router.post('/send', authMiddleware, whatsappController.sendMessage);
router.post('/send-bulk', authMiddleware, whatsappController.sendBulkMessages);

// Read messages
router.get('/chats/:clientId', authMiddleware, whatsappController.getAllChats);
router.get('/chats/:clientId/unread', authMiddleware, whatsappController.getUnreadChats);

module.exports = router;
