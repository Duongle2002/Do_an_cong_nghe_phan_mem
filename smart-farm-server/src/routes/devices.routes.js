const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { listDevices, createDevice, getDevice, updateDevice, deleteDevice, createDeviceValidators } = require('../controllers/devices.controller');

router.use(authenticate);

// Get all devices
router.get('/', listDevices);

// Get a single device by ID
router.get('/:id', getDevice);

// Create a new device
router.post('/', createDeviceValidators, handleValidation, createDevice);

// Update a device by ID
router.put('/:id', updateDevice);

// Delete a device by ID
router.delete('/:id', deleteDevice);

module.exports = router;
