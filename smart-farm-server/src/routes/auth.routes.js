const router = require('express').Router();
const { handleValidation } = require('../middleware/validate');
const { register, registerValidators, login, loginValidators, refresh, refreshValidators, logout, logoutValidators } = require('../controllers/auth.controller');

router.post('/register', registerValidators, handleValidation, register);
router.post('/login', loginValidators, handleValidation, login);
router.post('/refresh', refreshValidators, handleValidation, refresh);
router.post('/logout', logoutValidators, handleValidation, logout);

module.exports = router;
