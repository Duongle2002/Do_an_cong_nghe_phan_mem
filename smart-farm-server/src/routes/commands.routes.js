const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { create, createValidators, list, listValidators, nextForDevice, nextValidators, updateStatus, updateStatusValidators } = require('../controllers/commands.controller');

router.use(authenticate);

router.post('/', createValidators, handleValidation, create);
router.get('/', listValidators, handleValidation, list);
router.get('/next', nextValidators, handleValidation, nextForDevice);
router.put('/:id/status', updateStatusValidators, handleValidation, updateStatus);

module.exports = router;
