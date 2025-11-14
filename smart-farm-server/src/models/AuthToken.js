const mongoose = require('mongoose');

const AuthTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiry: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuthToken', AuthTokenSchema);
