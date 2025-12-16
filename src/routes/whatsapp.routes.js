const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const authMiddleware = require('../middlewares/auth');

// All routes protected with authentication
router.post('/send', authMiddleware, whatsappController.sendMessage);
router.post('/send-bulk', authMiddleware, whatsappController.sendBulkMessages);

module.exports = router;
