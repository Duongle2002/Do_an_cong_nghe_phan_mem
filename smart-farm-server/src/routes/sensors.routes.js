const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { ingest, ingestValidators, list, listValidators } = require('../controllers/sensors.controller');

router.use(authenticate);

router.post('/ingest', ingestValidators, handleValidation, ingest);
router.get('/', listValidators, handleValidation, list);

module.exports = router;
