const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validate');
const { listUsers, createUser, getUser, updateUser, deleteUser, createUserValidators } = require('../controllers/users.controller');

router.use(authenticate);

router.get('/', authorize('Admin'), listUsers);
router.post('/', authorize('Admin'), createUserValidators, handleValidation, createUser);
router.get('/:id', authorize('Admin'), getUser);
router.put('/:id', authorize('Admin'), updateUser);
router.delete('/:id', authorize('Admin'), deleteUser);

module.exports = router;
