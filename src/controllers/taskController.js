const { createTask, getTasksByProject, updateTaskStatus } = require('../models/taskModel');

const addTask = async (req, res) => {
  const { title, project_id, assigned_to, due_date } = req.body;

  try {
    const { data, error } = await createTask({ title, project_id, assigned_to, due_date, status: 'pending' });
    if (error) throw error;

    res.status(201).json({ task: data[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getTasks = async (req, res) => {
  const { projectId } = req.params;
  try {
    const { data, error } = await getTasksByProject(projectId);
    if (error) throw error;

    res.status(200).json({ tasks: data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const changeStatus = async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;

  try {
    const { data, error } = await updateTaskStatus(taskId, status);
    if (error) throw error;

    res.status(200).json({ task: data[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { addTask, getTasks, changeStatus };
