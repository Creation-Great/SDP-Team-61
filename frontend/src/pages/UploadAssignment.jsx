import { useState } from "react";
import { motion } from "framer-motion";
import API from "../services/api";

export default function UploadAssignment() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!title || !file) {
      setMessage("Please enter a title and choose a file.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("file", file);

    try {
      await API.post("/assignments/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMessage("Upload successful!");
      setTitle("");
      setDescription("");
      setFile(null);
    } catch (err) {
      console.error(err);
      setMessage("Upload failed. Try again.");
    }
  };

  const placeholderStyle = `
    ::placeholder {
      color: rgba(255,255,255,0.88) !important;
      opacity: 1 !important;
    }
  `;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        paddingTop: "120px",
        paddingBottom: "60px",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        width: "100%",
      }}
    >
      <style>{placeholderStyle}</style>

      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          width: "90%",
          maxWidth: "720px",
          backdropFilter: "blur(20px)",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.25)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          borderRadius: "20px",
          padding: "45px",
        }}
      >
        <h1
          style={{
            color: "white",
            textAlign: "center",
            marginBottom: "25px",
            fontSize: "38px",
            fontWeight: "700",
          }}
        >
          Upload Assignment
        </h1>

        <form
          onSubmit={handleUpload}
          style={{ display: "flex", flexDirection: "column", gap: "22px" }}
        >
          <input
            type="text"
            placeholder="Assignment Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              padding: "16px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.25)", // FIXED CONTRAST
              color: "rgba(255,255,255,0.95)",      // FIXED TEXT BRIGHTNESS
              fontSize: "17px",
              outline: "none",
              backdropFilter: "blur(5px)",
            }}
          />

          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{
              padding: "16px",
              minHeight: "150px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.25)", // FIXED CONTRAST
              color: "rgba(255,255,255,0.95)",      // FIXED TEXT BRIGHTNESS
              fontSize: "17px",
              resize: "vertical",
              outline: "none",
              backdropFilter: "blur(5px)",
            }}
          />

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: "2px dashed rgba(255,255,255,0.4)",
              borderRadius: "16px",
              padding: "35px",
              textAlign: "center",
              color: "white",
              cursor: "pointer",
              transition: "0.25s",
              background: isDragging
                ? "rgba(255,255,255,0.18)"
                : "rgba(255,255,255,0.12)",
              backdropFilter: "blur(5px)",
            }}
            onClick={() => document.getElementById("fileInput").click()}
          >
            {file ? (
              <span style={{ fontSize: "17px" }}>📄 {file.name}</span>
            ) : (
              <span style={{ fontSize: "17px", opacity: 0.95 }}>
                Drag & drop a file here, or click to browse
              </span>
            )}
            <input
              id="fileInput"
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              style={{ display: "none" }}
            />
          </div>

          <motion.button
            type="submit"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            style={{
              background: "linear-gradient(135deg, #56CCF2, #2F80ED)",
              padding: "15px",
              borderRadius: "14px",
              color: "white",
              fontSize: "20px",
              fontWeight: "600",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            }}
          >
            Upload
          </motion.button>
        </form>

        {message && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              marginTop: "22px",
              textAlign: "center",
              color: "white",
              fontSize: "17px",
              opacity: 0.9,
            }}
          >
            {message}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
