import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  action: { type: String, enum: ["ON", "OFF"], required: true },
  time: Date,
  repeat: { type: String, enum: ["once", "daily", "weekly"], default: "once" },
  active: { type: Boolean, default: true },
});

export default mongoose.model("Schedule", scheduleSchema);
