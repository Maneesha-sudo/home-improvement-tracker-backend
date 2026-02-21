const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { getUserByEmail, createUser } = require("../models/userModel");
// ✅ REGISTER
const register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    console.log("Register body:", req.body);

    const existing = await getUserByEmail(email);

    if (existing.data && existing.data.length > 0) {
      return res.status(400).json({ message: "User exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const { data, error } = await createUser({
      name,
      email,
      password: hashed,
    });

    if (error) throw error;
    if (!data || data.length === 0)
      throw new Error("User creation failed");

    if (!process.env.JWT_SECRET)
      throw new Error("JWT_SECRET not defined");

    const token = jwt.sign(
      { id: data[0].id, email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ token, user: data[0] });

  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ✅ LOGIN (ADDED THIS)
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const existing = await getUserByEmail(email);

    if (!existing.data || existing.data.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = existing.data[0];

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login };