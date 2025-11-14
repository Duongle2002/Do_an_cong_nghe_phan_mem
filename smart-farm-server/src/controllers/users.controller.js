const { body } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const createUserValidators = [
  body('name').isString().notEmpty(),
  body('email').isEmail(),
  body('password').isString().isLength({ min: 6 }),
  body('role').optional().isIn(['Farmer', 'Admin']),
];

async function listUsers(req, res) {
  const users = await User.find({}, 'name email role createdAt').lean();
  res.json(users);
}

async function createUser(req, res) {
  const { name, email, password, role = 'Farmer' } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: 'Email already exists' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role });
  res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
}

async function getUser(req, res) {
  const user = await User.findById(req.params.id, 'name email role createdAt').lean();
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
}

async function updateUser(req, res) {
  const { name, role } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (name) user.name = name;
  if (role) user.role = role;
  await user.save();
  res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
}

async function deleteUser(req, res) {
  const deleted = await User.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'User not found' });
  res.json({ ok: true });
}

module.exports = { listUsers, createUser, getUser, updateUser, deleteUser, createUserValidators };
