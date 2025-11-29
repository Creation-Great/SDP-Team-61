import jwt from "jsonwebtoken";
import User from "../models/User.js";
import bcrypt from "bcrypt";

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
};

// REGISTER
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already exists" });

    const user = await User.create({ name, email, password, role });

    res.json({
      token: generateToken(user),
      user: { id: user._id, name, email, role },
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// LOGIN
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const match = await user.matchPassword(password);
  if (!match) return res.status(401).json({ message: "Invalid credentials" });

  res.json({
    token: generateToken(user),
    user: { id: user._id, name: user.name, email, role: user.role },
  });
};
