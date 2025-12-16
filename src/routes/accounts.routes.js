const express = require('express');
const router = express.Router();
const accountsController = require('../controllers/accountsController');
const authMiddleware = require('../middlewares/auth');

// All account routes require authentication
router.use(authMiddleware);

// Create new WhatsApp account
router.post('/', accountsController.createAccount);

// List all user accounts
router.get('/', accountsController.listAccounts);

// Get status of a specific account
router.get('/:clientId/status', accountsController.getAccountStatus);

// Get account statistics
router.get('/:clientId/stats', accountsController.getAccountStats);

// Initialize/restart an account
router.post('/:clientId/initialize', accountsController.initializeAccount);

// Update account name
router.patch('/:clientId', accountsController.updateAccountName);

// Delete (deactivate) an account
router.delete('/:clientId', accountsController.deleteAccount);

module.exports = router;
