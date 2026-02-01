import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";

/* ===== PATH SETUP ===== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===== APP INIT ===== */
const app = express();
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/* ===== SESSION CONFIG ===== */
app.use(session({
  secret: "change-this-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true }
}));

/* ===== DEMO USER ===== */
const USERNAME = "admin";
const HASHED_PASSWORD = await bcrypt.hash("2026@#", 10);

/* ===== AUTH CHECK ===== */
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ success:false, msg:"Login required ❌" });
  }
  next();
}

/* ===== ROUTES ===== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

/* ===== LOGIN ===== */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) return res.json({ success:false });
  if (username !== USERNAME) return res.json({ success:false });

  const ok = await bcrypt.compare(password, HASHED_PASSWORD);
  if (!ok) return res.json({ success:false });

  req.session.user = username;
  res.json({ success:true });
});

/* ===== LOGOUT ===== */
app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success:true }));
});

/* ===== SIMPLE ANTI-ABUSE DELAY ===== */
const lastSendTime = {};

function canSend(user) {
  const now = Date.now();
  if (!lastSendTime[user] || now - lastSendTime[user] > 5000) {
    lastSendTime[user] = now;
    return true;
  }
  return false;
}

/* ===== SAFE MAIL ENDPOINT ===== */
app.post("/send", requireLogin, async (req, res) => {
  const { senderName, replyTo, subject, tag, message, to } = req.body;

  if (!subject || !message || !to)
    return res.json({ success:false, msg:"All required fields ❌" });

  if (!canSend(req.session.user))
    return res.json({ success:false, msg:"Please wait a moment ⏳" });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to))
    return res.json({ success:false, msg:"Invalid email ❌" });

  /*
     👉 Production me yahan server-side authorized mail service call hota hai.
     Frontend se kabhi mailbox password nahi liya jata.
  */

  console.log("Mail logged:", {
    user: req.session.user,
    senderName,
    replyTo,
    subject,
    tag,
    to
  });

  res.json({ success:true, msg:"Mail Sent ✅" });
});

/* ===== SERVER START ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Secure Mail Console running on port", PORT);
});
