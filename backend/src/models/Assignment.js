import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  filename: { type: String, required: true },
  status: { type: String, default: "Submitted" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Assignment", assignmentSchema);
