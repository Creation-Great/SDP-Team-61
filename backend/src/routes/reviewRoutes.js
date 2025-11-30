// backend/src/routes/reviewRoutes.js
import express from "express";
import Review from "../models/Review.js";
import Assignment from "../models/Assignment.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| ⭐ Get reviews for a specific assignment (for Students)
|--------------------------------------------------------------------------
*/
router.get(
  "/by-assignment/:assignmentId",
  authMiddleware,
  async (req, res) => {
    try {
      const assignment = await Assignment.findById(
        req.params.assignmentId
      );

      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }

      // FIXED FIELD NAME: assignment.user, NOT assignment.student
      if (assignment.user.toString() !== req.user.id) {
        return res
          .status(403)
          .json({ message: "Not authorized to view this review" });
      }

      const reviews = await Review.find({
        assignment: assignment._id,
      })
        .populate("reviewer", "name email")
        .populate("assignment", "title fileUrl")
        .sort({ createdAt: -1 });

      return res.json({
        assignment,
        reviews,
      });
    } catch (error) {
      console.error("Get reviews for assignment error:", error);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET a single review
|--------------------------------------------------------------------------
*/
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate(
      "assignment"
    );

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json(review);
  } catch (err) {
    console.error("GET review error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/*
|--------------------------------------------------------------------------
| Submit a review
|--------------------------------------------------------------------------
*/
router.post("/:id/submit", authMiddleware, async (req, res) => {
  try {
    const { score, reviewText } = req.body;

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    review.score = score;
    review.comments = reviewText;
    review.completed = true;

    await review.save();

    res.json({ message: "Review submitted successfully!" });
  } catch (err) {
    console.error("Submit review error:", err);
    res.status(500).json({ message: "Server error submitting review" });
  }
});

export default router;
