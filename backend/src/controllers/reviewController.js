import Review from "../models/Review.js";
import Assignment from "../models/Assignment.js";

// ==============================
// Get review task by ID
// ==============================
export const getReviewById = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate("assignment")
      .populate("reviewer", "name email");

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json(review);
  } catch (err) {
    res.status(500).json({ message: "Failed to load review" });
  }
};

// ==============================
// Submit Review
// ==============================
export const submitReview = async (req, res) => {
  try {
    const { score, comments } = req.body;

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    review.score = score;
    review.comments = comments;
    review.status = "submitted"; // matches the Review model enum

    await review.save();

    // Optionally mark assignment as reviewed
    await Assignment.findByIdAndUpdate(review.assignment, {
      status: "Reviewed",
    });

    res.json({ message: "Review submitted successfully" });
  } catch (err) {
    console.error("Submit review error:", err);
    res.status(500).json({ message: "Failed to submit review" });
  }
};
