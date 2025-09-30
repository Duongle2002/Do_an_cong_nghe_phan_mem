import express from "express"; 
import SensorData from "../models/SensorData.js"; 
const router = express.Router(); 
router.post("/", async (req, res) => { 
    try { const data = new SensorData(req.body); 
        await data.save(); res.json({ message: "Data saved", data }); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    } 
}); 
router.get("/:deviceId", async (req, res) => { 
    try { 
        const { deviceId } = req.params; 
        const data = await SensorData.find({ deviceId }).sort({ timestamp: -1 }).limit(20); 
        res.json(data); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    } 
}); 
export default router;