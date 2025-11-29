// backend/src/routes/reviewRoutes.js
import express from "express";
import Review from "../models/Review.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// GET A SINGLE REVIEW
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate("assignment");

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json(review);
  } catch (err) {
    console.error("GET review error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// SUBMIT A REVIEW
router.post("/:id/submit", authMiddleware, async (req, res) => {
  try {
    const { score, reviewText } = req.body;

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    review.score = score;
    review.comments = reviewText;
    review.completed = true;      // 🔥 MARK AS DONE

    await review.save();

    res.json({ message: "Review submitted successfully!" });
  } catch (err) {
    console.error("Submit review error:", err);
    res.status(500).json({ message: "Server error submitting review" });
  }
});

export default router;
