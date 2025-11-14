const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { listDevices, createDevice, getDevice, updateDevice, deleteDevice, createDeviceValidators } = require('../controllers/devices.controller');

router.use(authenticate);

router.get('/', listDevices);
router.post('/', createDeviceValidators, handleValidation, createDevice);
router.get('/:id', getDevice);
router.put('/:id', updateDevice);
router.delete('/:id', deleteDevice);

module.exports = router;
