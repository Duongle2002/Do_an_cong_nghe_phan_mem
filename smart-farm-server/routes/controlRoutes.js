import express from "express"; 
import { sendControlCommand } 
from "../mqttClient.js"; 
const router = express.Router(); 
// POST /api/control 
router.post("/", async (req, res) => {
    try { 
        const { deviceId, action } = req.body; 
        if (!deviceId || !action) { 
            return res.status(400).json({ error: "deviceId and action are required" }); 
        } 
    // Gửi lệnh qua MQTT 
        sendControlCommand(deviceId, action); 
        res.json({ message: "Command sent", deviceId, action }); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    } });
export default router;