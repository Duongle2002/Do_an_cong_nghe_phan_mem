import express from "express"; 
import Device from "../models/Device.js"; 
const router = express.Router(); 
router.post("/", async (req, res) => { 
    try { const device = new Device(req.body); 
        await device.save(); 
        res.json({ message: "Device registered", device }); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    } 
}); 
router.get("/", async (req, res) => { 
    try { const devices = await Device.find(); 
        res.json(devices); 
    } catch (err) {
        res.status(500).json({ error: err.message }); 
    } 
}); 
export default router;