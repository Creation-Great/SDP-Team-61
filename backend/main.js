import express from "express";
import session from "express-session";
import CASAuthentication from "cas-authentication";
import dotenv from "dotenv";

dotenv.config();
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
  const role = determineRole(netid);
  req.session.role = role;

  if (role === "faculty") res.redirect("/faculty");
  else res.redirect("/student");
});

// Logout route
app.get("/logout", cas.logout);


app.get("/student", requireRole("student"), (req, res) => {
  res.send(`
    <h1>Student Dashboard</h1>
    <p>Welcome ${req.session[cas.session_name]}</p>
    <a href='/logout'>Logout</a>
  `);
});

app.listen(5000, () =>
  console.log("Server running on http://localhost:5000")
);
