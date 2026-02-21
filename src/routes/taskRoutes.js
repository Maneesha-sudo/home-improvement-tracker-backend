const express = require('express');
const router = express.Router();
const { addTask, getTasks, changeStatus } = require('../controllers/taskController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, addTask);
router.get('/:projectId', auth, getTasks);
router.patch('/:taskId/status', auth, changeStatus);

module.exports = router;
