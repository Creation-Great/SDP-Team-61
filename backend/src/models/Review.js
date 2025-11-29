// backend/src/models/Review.js
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Assignment",
    required: true,
  },

  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  score: {
    type: Number,
    default: null,
  },

  comments: {
    type: String,
    default: "",
  },

  completed: {
    type: Boolean,
    default: false, // 🔥 IMPORTANT
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Review", reviewSchema);
