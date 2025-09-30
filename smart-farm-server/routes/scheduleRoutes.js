import express from "express"; 
import Schedule from "../models/Schedule.js"; 
const router = express.Router(); 
router.post("/", async (req, res) => { 
    try { const schedule = new Schedule(req.body); 
        await schedule.save(); 
        res.json({ message: "Schedule created", schedule }); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    } 
}); 
router.get("/:deviceId", async (req, res) => { 
    try { 
        const schedules = await Schedule.find({ deviceId: req.params.deviceId }); 
        res.json(schedules); 
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    } 
}); 
export default router;