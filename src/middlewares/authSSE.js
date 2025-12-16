const jwt = require('jsonwebtoken');
const config = require('../config/env');

// Middleware especial para SSE que acepta token por query parameter
const authSSEMiddleware = (req, res, next) => {
  try {
    // Intentar obtener token del header Authorization o del query parameter
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado'
      });
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido o expirado'
    });
  }
};

module.exports = authSSEMiddleware;
