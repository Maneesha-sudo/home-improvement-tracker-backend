const express = require('express');
const router = express.Router();
const { addProject, addMember, getProjects } = require('../controllers/projectController');
const auth = require('../middleware/authMiddleware');

router.post('/', auth, addProject);
router.get('/', auth, getProjects);
router.post('/:projectId/add-member', auth, addMember);

module.exports = router;
