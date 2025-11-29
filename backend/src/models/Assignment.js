import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: { type: String, required: true },

    description: { type: String, default: "" },

    filename: { type: String, required: true },

    // Needed for showing PDF in the reviewer screen
    fileUrl: { type: String, required: true },

    status: {
      type: String,
      enum: ["Submitted", "Reviewed"],
      default: "Submitted",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Assignment", assignmentSchema);
