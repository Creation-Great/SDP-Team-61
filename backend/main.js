import express from "express";
import session from "express-session";
import CASAuthentication from "cas-authentication";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

// File path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// App setup
const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// Initialize CAS
const cas = new CASAuthentication({
  cas_url: process.env.CAS_URL,
  service_url: process.env.SERVICE_URL,
  renew: false,
  is_dev_mode: false,
});

const upload = multer({ dest: UPLOAD_DIR });

// Temporary in-memory storage
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

// --- Routes ---

// Default route
app.get("/", (req, res) => {
  res.send(`
    <h1>Peer Review Login</h1>
    <p>Log in using your UConn NetID and Password.</p>
    <a href="/login">Login</a>
  `);
});

// Login route
app.get("/login", cas.bounce, (req, res) => {
  const netid = req.session[cas.session_name];
  res.redirect("/student");
});

// Logout route
app.get("/logout", cas.logout);

// Student dashboard
app.get("/student", (req, res) => {
  res.send(`
    <h1>Student Dashboard</h1>
    <p>Welcome ${req.session[cas.session_name]}</p>
    <a href='/submit-document'>Submit Document</a><br/>
    <a href='/logout'>Logout</a>
  `);
});

// Faculty dashboard
app.get("/faculty", (req, res) => {
  res.send(`
    <h1>Faculty Dashboard</h1>
    <p>Welcome ${req.session[cas.session_name]}</p>
    <a href='/logout'>Logout</a>
  `);
});

// Document submission form
app.get("/submit-document", (req, res) => {
  res.send(`
    <h1>Submit Document (PDF)</h1>
    <form action="/submit-document" method="post" enctype="multipart/form-data">
      <label for="title">Title:</label><br/>
      <input type="text" id="title" name="title" required /><br/><br/>

      <label for="file">PDF File:</label><br/>
      <input type="file" id="file" name="file" accept="application/pdf" required /><br/><br/>

      <button type="submit">Submit</button>
    </form>
    <br/>
    <a href="/student">Back to Dashboard</a>
  `);
});

// Document submission handler
app.post("/submit-document", upload.single("file"), (req, res) => {
  const owner = req.session[cas.session_name];
  const { title } = req.body || {};
  if (!title) return res.status(400).send("Title is required.");
  if (!req.file) return res.status(400).send("PDF file is required.");

  const reviewer = pickRandomReviewer(owner);

  const doc = {
    id: NEXT_DOC_ID++,
    owner,
    title,
    fileStoredName: req.file.filename,
    fileOriginalName: req.file.originalname,
    fileSize: req.file.size,
    fileMime: req.file.mimetype,
    storedPath: req.file.path,
    submissionDate: new Date().toISOString(),
    reviewer,
    reviewDate: null,
    reviewStatus: reviewer ? "assigned" : "pending",
    reviewFeedback: null,
  };

  DOCS.push(doc);
  console.log("New document:", doc);

  return res.redirect("/student");
});

app.listen(5000, () =>
  console.log(" Server running on http://localhost:5000")
);
