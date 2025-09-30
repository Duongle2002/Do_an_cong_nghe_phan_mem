import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import dataRoutes from "./routes/dataRoutes.js";
import deviceRoutes from "./routes/deviceRoutes.js";
import scheduleRoutes from "./routes/scheduleRoutes.js";
import controlRoutes from "./routes/controlRoutes.js";

import client from "./mqttClient.js";
import { startScheduler } from "./scheduler.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// Routes
app.use("/api/data", dataRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/control", controlRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// Start services
startScheduler();
