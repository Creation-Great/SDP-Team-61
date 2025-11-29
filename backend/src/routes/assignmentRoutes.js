// backend/src/routes/assignmentRoutes.js
import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  uploadAssignment,
  getMyAssignments,
  getAllAssignments,
} from "../controllers/assignmentController.js";
import Review from "../models/Review.js";

const router = express.Router();

// STUDENT UPLOAD
router.post("/upload", authMiddleware, upload.single("file"), uploadAssignment);

// STUDENT VIEW OF THEIR OWN ASSIGNMENTS
router.get("/mine", authMiddleware, getMyAssignments);

// INSTRUCTOR VIEW OF ALL ASSIGNMENTS
router.get("/all", authMiddleware, getAllAssignments);

// REVIEWER – VIEW THEIR ASSIGNED REVIEWS
router.get("/reviews/my-tasks", authMiddleware, async (req, res) => {
  try {
    const tasks = await Review.find({
      reviewer: req.user._id,
      completed: false,          // 🔥 ONLY SHOW PENDING REVIEWS
    }).populate("assignment");

    res.json(tasks);
  } catch (err) {
    console.error("Error fetching review tasks:", err);
    res.status(500).json({ message: "Failed to fetch review tasks" });
  }
});

export default router;
