const supabase = require('../config/supabaseClient');
const { createProject, getProjectsByUser } = require('../models/projectModel');

const addProject = async (req, res) => {
  const { title, description } = req.body;
  const owner = req.user.id;

  try {
    const { data, error } = await createProject({ title, description, owner });
    if (error) throw error;

    res.status(201).json({ project: data[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add member by email
const addMember = async (req, res) => {
  const { projectId } = req.params;
  const { email } = req.body;

  try {
    const { data: user } = await supabase.from('users').select('*').eq('email', email).single();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { data, error } = await supabase.from('project_members').insert([{ project_id: projectId, user_id: user.id }]);
    if (error) throw error;

    res.status(200).json({ member: data[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getProjects = async (req, res) => {
  try {
    const { data, error } = await getProjectsByUser(req.user.id);
    if (error) throw error;

    res.status(200).json({ projects: data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { addProject, addMember, getProjects };
