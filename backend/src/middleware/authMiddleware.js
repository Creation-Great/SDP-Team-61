import jwt from "jsonwebtoken";
import User from "../models/User.js";

export default async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ message: "No token provided" });

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    next();
  } catch (err) {
    console.error("AUTH ERROR:", err);
    res.status(401).json({ message: "Invalid token" });
  }
}
