import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";

/* ===== BASIC SETUP ===== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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

/* ===== DEMO USER SETUP ===== */
const USERNAME = "admin";
const HASHED_PASSWORD = await bcrypt.hash("2026@#", 10);

/* ===== AUTH MIDDLEWARE ===== */
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

/* ===== LOGIN HANDLER ===== */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.json({ success:false });

  if (username !== USERNAME)
    return res.json({ success:false });

  const match = await bcrypt.compare(password, HASHED_PASSWORD);
  if (!match)
    return res.json({ success:false });

  req.session.user = username;
  res.json({ success:true });
});

/* ===== LOGOUT ===== */
app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success:true }));
});

/* ===== SIMPLE RATE PROTECTION (ANTI ABUSE) ===== */
const userLastSendTime = {};

function checkCooldown(user) {
  const now = Date.now();
  if (!userLastSendTime[user]) {
    userLastSendTime[user] = now;
    return true;
  }
  if (now - userLastSendTime[user] < 5000) { // 5 sec gap
    return false;
  }
  userLastSendTime[user] = now;
  return true;
}

/* ===== SAFE MAIL ENDPOINT ===== */
app.post("/send", requireLogin, async (req, res) => {
  const { senderName, replyTo, subject, tag, message, to } = req.body;

  if (!subject || !message || !to)
    return res.json({ success:false, msg:"All required fields missing ❌" });

  if (!checkCooldown(req.session.user))
    return res.json({ success:false, msg:"Please wait before next mail ⏳" });

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(to))
    return res.json({ success:false, msg:"Invalid recipient email ❌" });

  /* 
     👉 Yaha production system me authorized mail service call hota hai.
     Frontend se passwords nahi liye jaate.
  */

  console.log("Mail Request Logged:", {
    fromUser: req.session.user,
    senderName,
    replyTo,
    subject,
    tag,
    to
  });

  return res.json({ success:true, msg:"Mail Sent ✅" });
});

/* ===== SERVER START ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Secure Mail Console running on port", PORT);
});
