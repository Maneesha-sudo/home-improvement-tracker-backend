const supabase = require('../config/supabaseClient');

const createUser = async (user) => {
  const { data, error } = await supabase.from('users').insert([user]);
  return { data, error };
};

const getUserByEmail = async (email) => {
  const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('email', email);
  return { data, error };
};

module.exports = { createUser, getUserByEmail };
