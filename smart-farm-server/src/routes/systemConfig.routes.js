const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getSmtpSettings, updateSmtpSettings, testSmtpSettings, getSystemOverview, getEmailLogs } = require('../controllers/systemConfig.controller');

router.use(authenticate, authorize('Admin'));

router.get('/smtp', getSmtpSettings);
router.put('/smtp', updateSmtpSettings);
router.post('/smtp/test', testSmtpSettings);
router.get('/overview', getSystemOverview);
router.get('/email-logs', getEmailLogs);

module.exports = router;
