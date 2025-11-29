import Assignment from "../models/Assignment.js";
import User from "../models/User.js";
import Review from "../models/Review.js";

// ==============================
// Upload Assignment + Assign Reviewer
// ==============================
export const uploadAssignment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { title, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Create assignment with fileUrl included
    const assignment = await Assignment.create({
      user: userId,
      title,
      description,
      filename: req.file.filename,
      fileUrl: `/uploads/${req.file.filename}`,   // 🔥 IMPORTANT
      status: "Submitted",
    });

    // Assign reviewer logic (same as before)
    let reviewers = await User.find({
      _id: { $ne: userId },
      role: "student",
    });

    if (reviewers.length === 0) {
      return res.status(200).json({
        message: "Assignment uploaded, but no reviewers available",
        assignment,
      });
    }

    const allReviews = await Review.find().populate("assignment");

    reviewers = reviewers.map((reviewer) => {
      const pendingCount = allReviews.filter(
        (r) =>
          r.reviewer.toString() === reviewer._id.toString() &&
          r.status === "pending"
      ).length;

      const hasReviewedThisStudentBefore = allReviews.some(
        (r) =>
          r.reviewer.toString() === reviewer._id.toString() &&
          r.assignment?.user?.toString() === userId.toString()
      );

      return {
        reviewer,
        pendingCount,
        hasReviewedThisStudentBefore,
      };
    });

    let filtered = reviewers.filter((r) => !r.hasReviewedThisStudentBefore);

    if (filtered.length === 0) filtered = reviewers;

    const chosenReviewer = filtered.sort(
      (a, b) => a.pendingCount - b.pendingCount
    )[0].reviewer;

    await Review.create({
      assignment: assignment._id,
      reviewer: chosenReviewer._id,
      status: "pending",
    });

    res.json({
      message: "Assignment uploaded and reviewer assigned",
      assignment,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed" });
  }
};

// ==============================
// Get My Assignments
// ==============================
export const getMyAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch assignments" });
  }
};

// ==============================
// Get All Assignments
// ==============================
export const getAllAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find()
      .populate("user", "name email role")
      .sort({ createdAt: -1 });

    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch all assignments" });
  }
};
