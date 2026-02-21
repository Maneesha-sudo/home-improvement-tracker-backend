const supabase = require('../config/supabaseClient');

const createProject = async (project) => {
  const { data, error } = await supabase.from('projects').insert([project]).select();
  return { data, error };
};

const getProjectsByUser = async (userId) => {
  const { data, error } = await supabase
    .from('projects')
    .select(`*, project_members(user_id)`)
    .or(`owner.eq.${userId},project_members.user_id.eq.${userId}`);
  return { data, error };
};

module.exports = { createProject, getProjectsByUser };
