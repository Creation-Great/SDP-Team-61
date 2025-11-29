import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  uploadAssignment,
  getMyAssignments,
  getAllAssignments,
} from "../controllers/assignmentController.js";

const router = express.Router();

// STUDENT UPLOAD
router.post("/upload", authMiddleware, upload.single("file"), uploadAssignment);

// STUDENT VIEW OF THEIR OWN ASSIGNMENTS
router.get("/mine", authMiddleware, getMyAssignments);

// INSTRUCTOR VIEW OF ALL ASSIGNMENTS
router.get("/all", authMiddleware, getAllAssignments);

export default router;
