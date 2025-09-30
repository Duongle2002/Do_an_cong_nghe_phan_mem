import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, unique: true, required: true },
  name: String,
  location: String,
  status: { type: String, enum: ["online", "offline"], default: "offline" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Device", deviceSchema);
