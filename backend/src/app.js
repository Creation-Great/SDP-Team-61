import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";
import assignmentRoutes from "./routes/assignmentRoutes.js";

dotenv.config();  // Load .env variables

const app = express();

app.use(cors());
app.use(express.json());

// Connect to MongoDB (Mongoose v9 syntax)
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

// Routes
app.use("/auth", authRoutes);
app.use("/assignments", assignmentRoutes);

export default app;
