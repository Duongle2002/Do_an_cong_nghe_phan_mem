const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const {
  register,
  registerValidators,
  login,
  loginValidators,
  verifyOtp,
  verifyOtpValidators,
  resendOtp,
  resendOtpValidators,
  refresh,
  refreshValidators,
  logout,
  logoutValidators,
  getProfile,
  updateProfile,
} = require('../controllers/auth.controller');

router.post('/register', registerValidators, handleValidation, register);
router.post('/login', loginValidators, handleValidation, login);
router.post('/verify-otp', verifyOtpValidators, handleValidation, verifyOtp);
router.post('/resend-otp', resendOtpValidators, handleValidation, resendOtp);
router.post('/refresh', refreshValidators, handleValidation, refresh);
router.post('/logout', logoutValidators, handleValidation, logout);

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

module.exports = router;
