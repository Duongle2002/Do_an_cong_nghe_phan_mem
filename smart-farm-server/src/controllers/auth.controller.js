const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const validator = require('validator');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const User = require('../models/User');
const AuthToken = require('../models/AuthToken');
const emailService = require('../services/emailService');

const emailCustomValidator = (value) => {
  const relaxed = process.env.RELAXED_EMAIL === 'true' || process.env.NODE_ENV !== 'production';
  if (validator.isEmail(value)) return true;
  if (relaxed && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return true;
  throw new Error('Invalid value');
};

const registerValidators = [
  body('name').isString().notEmpty(),
  body('email').isString().notEmpty().custom(emailCustomValidator),
  body('password').isString().isLength({ min: 6 }),
];

async function register(req, res) {
  const { name, email, password } = req.body;
  let user = await User.findOne({ email });
  
  if (user) {
    if (user.isVerified !== false) {
      return res.status(409).json({ message: 'Email đã tồn tại trên hệ thống.' });
    }
    // Update unverified user details in case they register again with different password/name
    const passwordHash = await bcrypt.hash(password, 10);
    user.name = name;
    user.passwordHash = passwordHash;
  } else {
    // Create new unverified user
    const passwordHash = await bcrypt.hash(password, 10);
    user = new User({ name, email, passwordHash, role: 'Farmer', isVerified: false });
  }

  // Generate 6-digit OTP code
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  user.otpCode = otpCode;
  user.otpExpiresAt = otpExpiresAt;
  await user.save();

  // Send email
  emailService.sendOTPEmail(email, otpCode).catch((err) => {
    console.error('Failed to send OTP email during registration:', err);
  });

  res.status(200).json({ message: 'Mã OTP đã được gửi đến email.', email });
}

const loginValidators = [
  body('email').isString().notEmpty().custom(emailCustomValidator),
  body('password').isString().notEmpty(),
];

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  // Block login for unverified accounts
  if (user.isVerified === false) {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.otpCode = otpCode;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    emailService.sendOTPEmail(email, otpCode).catch((err) => {
      console.error('Failed to send OTP email on unverified login attempt:', err);
    });

    return res.status(403).json({
      message: 'Tài khoản chưa được xác thực email. Mã OTP mới đã được gửi về email của bạn.',
      unverified: true,
      email: user.email
    });
  }

  const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role });
  const refreshToken = signRefreshToken({ sub: user._id.toString() });
  const expiry = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await AuthToken.create({ userId: user._id, accessToken, refreshToken, expiry });

  res.json({
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, alertEmail: user.alertEmail || '' },
  });
}

const verifyOtpValidators = [
  body('email').isString().notEmpty().custom(emailCustomValidator),
  body('otpCode').isString().isLength({ min: 6, max: 6 }),
];

async function verifyOtp(req, res) {
  const { email, otpCode } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });

  if (user.isVerified === true) {
    return res.status(400).json({ message: 'Tài khoản đã được xác thực trước đó.' });
  }

  if (user.otpCode !== otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    return res.status(400).json({ message: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
  }

  user.isVerified = true;
  user.otpCode = undefined;
  user.otpExpiresAt = undefined;
  await user.save();

  const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role });
  const refreshToken = signRefreshToken({ sub: user._id.toString() });
  const expiry = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await AuthToken.create({ userId: user._id, accessToken, refreshToken, expiry });

  res.json({
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role, alertEmail: user.alertEmail || '' },
  });
}

const resendOtpValidators = [
  body('email').isString().notEmpty().custom(emailCustomValidator),
];

async function resendOtp(req, res) {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });

  if (user.isVerified === true) {
    return res.status(400).json({ message: 'Tài khoản đã được xác thực trước đó.' });
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

  user.otpCode = otpCode;
  user.otpExpiresAt = otpExpiresAt;
  await user.save();

  emailService.sendOTPEmail(email, otpCode).catch((err) => {
    console.error('Failed to resend OTP email:', err);
  });

  res.json({ message: 'Đã gửi lại mã OTP thành công.' });
}

const refreshValidators = [body('refreshToken').isString().notEmpty()];

async function refresh(req, res) {
  const { refreshToken } = req.body;
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const stored = await AuthToken.findOne({ refreshToken, userId: decoded.sub });
    if (!stored) return res.status(401).json({ message: 'Invalid token' });
    const accessToken = signAccessToken({ sub: decoded.sub });
    stored.accessToken = accessToken;
    await stored.save();
    res.json({ accessToken });
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

const logoutValidators = [body('refreshToken').isString().notEmpty()];

async function logout(req, res) {
  const { refreshToken } = req.body;
  await AuthToken.deleteOne({ refreshToken });
  res.json({ ok: true });
}

async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.id, 'name email role alertEmail').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Error getting profile:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateProfile(req, res) {
  try {
    const { name, alertEmail } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    if (name !== undefined) user.name = name;
    if (alertEmail !== undefined) user.alertEmail = alertEmail.trim();
    
    await user.save();
    res.json({ id: user._id, name: user.name, email: user.email, role: user.role, alertEmail: user.alertEmail });
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
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
};
