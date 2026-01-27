require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// Render proxy fix
app.set("trust proxy", 1);

// Load from .env
const HARD_USERNAME = process.env.PANEL_USER;
const HARD_PASSWORD = process.env.PANEL_PASS;

let mailLimits = {};
const sessionStore = new session.MemoryStore();

app.use(bodyParser.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname 彩神争霸快, "public")));

app.use(session({
  secret: process.env.SESSION_SECRET || "fallback_secret",
  resave: false,
  saveUninitialized: true,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    secure: false, // important for Render
    sameSite: "lax",
    maxAge: 60 * 60 * 1000
  }
}));

function requireAuth(req, res, next) {
  if (req.session.user) return next();
  return res.redirect("/");
}

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!HARD_USERNAME || !HARD_PASSWORD) {
    return res.json({ success: false, message: "Server config missing (.env)" });
  }

  if (username === HARD_USERNAME && password === HARD_PASSWORD) {
    req.session.user = username;
    return res.json({ success: true });
  }

  res.json({ success: false, message: "Invalid login" });
});

app.get("/launcher", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "launcher.html"))
);

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

function cleanSubject(subject) {
  return (subject || "Hello").replace(/\r?\n/g, " ").trim();
}

function cleanBody(message) {
  return (message || "").replace(/\r\n/g, "\n").trim();
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// SEND MAIL (single recipient safe)
app.post("/send", requireAuth, async (req, res) => {
  try {
    const { senderName, email, password, recipients, subject, message } = req.body;

    const recipient = recipients
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(isValidEmail)[0];

    if (!recipient) {
      return res.json({ success: false, message: "Invalid recipient" });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: email, pass: password }
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"${senderName || "User"}" <${email}>`,
      to: recipient,
      subject: cleanSubject(subject),
      text: cleanBody(message),
      replyTo: email
    });

    res.json({ success: true, message: "Mail sent ✅" });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Send failed ❌" });
  }
});

app.listen(PORT, () =>
  console.log("✅ Server running on port", PORT)
);
