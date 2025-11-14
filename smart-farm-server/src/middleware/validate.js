const { validationResult } = require('express-validator');

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log validation errors for troubleshooting in dev
    try {
      console.warn('Validation failed for', req.method, req.originalUrl, errors.array());
    } catch (_) {}
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

module.exports = { handleValidation };
