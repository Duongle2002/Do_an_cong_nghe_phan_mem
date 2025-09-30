import mqtt from "mqtt";
import dotenv from "dotenv";
import SensorData from "./models/SensorData.js";

dotenv.config();

const client = mqtt.connect({
  host: process.env.MQTT_BROKER,
  port: process.env.MQTT_PORT
});

client.on("connect", () => {
  console.log("✅ Connected to MQTT broker:", process.env.MQTT_BROKER, process.env.MQTT_PORT);
  client.subscribe(process.env.MQTT_TOPIC_SENSOR);
});

client.on("message", async (topic, message) => {
  if (topic === process.env.MQTT_TOPIC_SENSOR) {
    try {
      const data = JSON.parse(message.toString());
      console.log("📥 Sensor Data:", data);
      const sensorData = new SensorData(data);
      await sensorData.save();
    } catch (err) {
      console.error("❌ Error parsing sensor data:", err);
    }
  }
});

export function sendControlCommand(deviceId, action) {
  const payload = JSON.stringify({ deviceId, action });
  client.publish(process.env.MQTT_TOPIC_CONTROL, payload);
  console.log("📤 Sent control command:", payload);
}

export default client;
