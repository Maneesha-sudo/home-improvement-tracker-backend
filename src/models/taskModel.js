const supabase = require('../config/supabaseClient');

const createTask = async (task) => {
  const { data, error } = await supabase.from('tasks').insert([task]).select();
  return { data, error };
};

const getTasksByProject = async (projectId) => {
  const { data, error } = await supabase.from('tasks').select('*').eq('project_id', projectId);
  return { data, error };
};

const updateTaskStatus = async (taskId, status) => {
  const { data, error } = await supabase.from('tasks').update({ status }).eq('id', taskId).select();
  return { data, error };
};

module.exports = { createTask, getTasksByProject, updateTaskStatus };
