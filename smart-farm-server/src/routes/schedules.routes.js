const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { create, createValidators, list, update, remove } = require('../controllers/schedules.controller');

router.use(authenticate);

router.post('/', createValidators, handleValidation, create);
router.get('/', list);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
