require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 8080;

// 🔥 IMPORTANT FOR RENDER
app.set("trust proxy", 1);

// ENV login
const HARD_USERNAME = process.env.PANEL_USER;
const HARD_PASSWORD = process.env.PANEL_PASS;

app.use(bodyParser.json({ limit: "50kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: process.env.SESSION_SECRET || "fallback_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,       // works now because of trust proxy
    sameSite: "lax",
    maxAge: 60 * 60 * 1000
  }
}));

// Rate limit
app.use("/send", rateLimit({
  windowMs: 60 * 1000,
  max: 3
}));

function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/");
}

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!HARD_USERNAME || !HARD_PASSWORD) {
    return res.json({ success: false, message: "Server not configured" });
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

function cleanText(t) {
  return (t || "").replace(/\r?\n{3,}/g, "\n\n").trim();
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

app.post("/send", requireAuth, async (req, res) => {
  try {
    const { senderName, email, password, subject, message, recipient } = req.body;

    if (!isValidEmail(email) || !password || !isValidEmail(recipient)) {
      return res.json({ success: false, message: "Invalid email details" });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: email, pass: password }
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"${senderName || email}" <${email}>`,
      to: recipient,
      subject: cleanText(subject) || "Hello",
      text: cleanText(message),
      replyTo: email,
      headers: { "X-Mailer": "NodeMailer" }
    });

    res.json({ success: true, message: "Mail sent successfully ✅" });

  } catch (err) {
    console.error("SEND ERROR:", err);
    res.json({ success: false, message: "Send failed ❌" });
  }
});

app.listen(PORT, () => console.log("Server running on port", PORT));
