import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  passwordHash: String,
  role: { type: String, enum: ["Farmer", "Admin"], default: "Farmer" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);

