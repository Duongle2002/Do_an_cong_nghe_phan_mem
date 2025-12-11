const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { ingest, ingestValidators, list, listValidators } = require('../controllers/sensors.controller');
const { checkAlertRules } = require('../services/alertService');
const AlertRule = require('../models/AlertRule');

// router.use(authenticate);

router.post('/ingest', ingestValidators, handleValidation, ingest);
router.get('/', listValidators, handleValidation, list);

// Debug endpoint: view all alert rules for device
router.get('/debug/alert-rules/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const rules = await AlertRule.find({ deviceId });
    res.json(rules);
  } catch (err) {
    console.error('Error fetching alert rules:', err);
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoint: manually test alert trigger
router.post('/test-alert/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { temperature, humidity, soilMoisture, lux } = req.body;
    
    console.log(`\n=== TEST ALERT FOR DEVICE ${deviceId} ===`);
    console.log('Input:', { temperature, humidity, soilMoisture, lux });
    
    await checkAlertRules(deviceId, { temperature, humidity, soilMoisture, lux });
    
    res.json({ message: 'Alert check completed, check server logs for details' });
  } catch (err) {
    console.error('Test alert error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
