// src/utils/validation.js

// Check if string is not empty
const isNotEmpty = (value) => value && value.trim() !== '';

// Validate email
const isValidEmail = (email) => {
  const regex = /^\S+@\S+\.\S+$/;
  return regex.test(email);
};

module.exports = { isNotEmpty, isValidEmail };