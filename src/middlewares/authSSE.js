const jwt = require('jsonwebtoken');
const config = require('../config/env');

// Special middleware for SSE that accepts token via query parameter
const authSSEMiddleware = (req, res, next) => {
  try {
    // Try to get token from Authorization header or query parameter
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token not provided'
      });
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

module.exports = authSSEMiddleware;
