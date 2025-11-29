import Assignment from "../models/Assignment.js";

export const uploadAssignment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { title, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const assignment = await Assignment.create({
      user: userId,
      title,
      description,
      filename: req.file.filename,
      status: "Submitted",
    });

    res.json(assignment);

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed" });
  }
};

export const getMyAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch assignments" });
  }
};

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
