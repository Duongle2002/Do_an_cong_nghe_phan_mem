const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { list } = require('../controllers/logs.controller');

router.use(authenticate, authorize('Admin'));

router.get('/', list);

module.exports = router;
