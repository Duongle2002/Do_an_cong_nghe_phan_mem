const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const validator = require('validator');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const User = require('../models/User');
const AuthToken = require('../models/AuthToken');

const registerValidators = [
  body('name').isString().notEmpty(),
  body('email')
    .isString()
    .notEmpty()
    .custom((value) => {
      // Allow relaxed email validation in development or when explicitly enabled
      const relaxed = process.env.RELAXED_EMAIL === 'true' || process.env.NODE_ENV !== 'production';
      if (validator.isEmail(value)) return true;
      if (relaxed && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return true;
      throw new Error('Invalid value');
    }),
  body('password').isString().isLength({ min: 6 }),
];

async function register(req, res) {
  const { name, email, password } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: 'Email already exists' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role: 'Farmer' });
  res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
}

const loginValidators = [
  body('email').isEmail(),
  body('password').isString().notEmpty(),
];

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role });
  const refreshToken = signRefreshToken({ sub: user._id.toString() });
  const expiry = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await AuthToken.create({ userId: user._id, accessToken, refreshToken, expiry });

  res.json({
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  });
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

module.exports = { register, registerValidators, login, loginValidators, refresh, refreshValidators, logout, logoutValidators };
