const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { create, createValidators, list, listValidators, markRead } = require('../controllers/alerts.controller');

router.use(authenticate);

router.post('/', createValidators, handleValidation, create);
router.get('/', listValidators, handleValidation, list);
router.put('/:id/read', markRead);

module.exports = router;
