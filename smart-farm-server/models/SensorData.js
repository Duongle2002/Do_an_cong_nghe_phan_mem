import mongoose from "mongoose";

const sensorDataSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  temperature: Number,
  humidity: Number,
  soilMoisture: Number,
  pH: Number,
  tds: Number,
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model("SensorData", sensorDataSchema);
