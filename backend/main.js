import express from "express";
import session from "express-session";
import CASAuthentication from "cas-authentication";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import cors from "cors";
import { fileURLToPath } from "url";

dotenv.config();

// File path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// App setup
const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";


app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// CAS setup
const cas = new CASAuthentication({
  cas_url: process.env.CAS_URL,
  service_url: process.env.SERVICE_URL,
  renew: false,
  is_dev_mode: false,
});

const upload = multer({ dest: UPLOAD_DIR });

//Temporary In-Memory Storage
let DOCS = [];
let NEXT_DOC_ID = 1;
const ASSIGNED_REVIEWERS = new Set();
const ROSTER = [];

// Random reviewer picker
function pickRandomReviewer(ownerNetid) {
  const pool = ROSTER.filter(
    (n) => n !== ownerNetid.toLowerCase() && !ASSIGNED_REVIEWERS.has(n)
  );
  if (pool.length === 0) return null;
  const reviewer = pool[Math.floor(Math.random() * pool.length)];
  ASSIGNED_REVIEWERS.add(reviewer);
  return reviewer;
}

// ROUTES

// Default
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "PeerReview backend active" });
});

// Login (handled by CAS)
app.get("/login", cas.bounce, (req, res) => {
  const netid = req.session[cas.session_name];
  req.session.netid = netid;
  console.log(`Logged in: ${netid}`);
  res.redirect(`${FRONTEND_URL}/student`);
});

// Logout
app.get("/logout", cas.logout);

// Handle document submission
app.post("/submit-document", upload.single("file"), (req, res) => {
  const owner = req.session[cas.session_name];
  const { title } = req.body || {};

  if (!owner) return res.status(401).json({ error: "Not authenticated" });
  if (!title) return res.status(400).json({ error: "Title is required." });
  if (!req.file) return res.status(400).json({ error: "PDF file is required." });

  const reviewer = pickRandomReviewer(owner);

  const doc = {
    id: NEXT_DOC_ID++,
    owner,
    title,
    fileStoredName: req.file.filename,
    fileOriginalName: req.file.originalname,
    fileSize: req.file.size,
    storedPath: req.file.path,
    submissionDate: new Date().toISOString(),
    reviewer,
    reviewStatus: reviewer ? "assigned" : "pending",
  };

  DOCS.push(doc);
  console.log(" New document submitted:", doc);

  res.status(201).json({ success: true, message: "Document uploaded.", doc });
});

// Server start
app.listen(5000, () => {
  console.log(" Backend running on http://localhost:5000");
});
