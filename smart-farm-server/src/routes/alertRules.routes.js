const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { create, createValidators, update, updateValidators, list, listValidators, deleteRule } = require('../controllers/alertRules.controller');

router.use(authenticate);

router.post('/', createValidators, handleValidation, create);
router.get('/', listValidators, handleValidation, list);
router.put('/:id', updateValidators, handleValidation, update);
router.delete('/:id', deleteRule);

module.exports = router;
