const express = require('express');
const router = express.Router();
const accountsController = require('../controllers/accountsController');
const authMiddleware = require('../middlewares/auth');

// Todas las rutas de cuentas requieren autenticación
router.use(authMiddleware);

// Crear nueva cuenta de WhatsApp
router.post('/', accountsController.createAccount);

// Listar todas las cuentas del usuario
router.get('/', accountsController.listAccounts);

// Obtener estado de una cuenta específica
router.get('/:clientId/status', accountsController.getAccountStatus);

// Obtener estadísticas de una cuenta
router.get('/:clientId/stats', accountsController.getAccountStats);

// Inicializar/reiniciar una cuenta
router.post('/:clientId/initialize', accountsController.initializeAccount);

// Actualizar nombre de una cuenta
router.patch('/:clientId', accountsController.updateAccountName);

// Eliminar (desactivar) una cuenta
router.delete('/:clientId', accountsController.deleteAccount);

module.exports = router;
