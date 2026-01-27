require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 8080;

const HARD_USERNAME = "mailinbox@#";
const HARD_PASSWORD = "mailinbox@#";

let mailLimits = {};
const sessionStore = new session.MemoryStore();

app.use(helmet());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "clean-mailer-secret",
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: { maxAge: 60 * 60 * 1000 }
}));

app.use("/login", rateLimit({ windowMs: 10 * 60 * 1000, max: 20 }));

function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/");
}

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === HARD_USERNAME && password === HARD_PASSWORD) {
    req.session.user = username;
    return res.redirect("/launcher");
  }
  res.send(`<script>alert("Invalid Login"); window.location="/";</script>`);
});

app.get("/launcher", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "launcher.html"))
);

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

const delay = ms => new Promise(r => setTimeout(r, ms));

/* ---------- SMART SAFE DELIVERY ENGINE ---------- */

async function sendWithBackoff(transporter, mail) {
  let attempt = 0;
  let wait = 400;

  while (attempt < 2) {
    try {
      await transporter.sendMail(mail);
      return;
    } catch (err) {
      attempt++;
      await delay(wait);
      wait *= 1.7; // gentle backoff
    }
  }
}

async function sendBatch(transporter, mails) {
  for (let i = 0; i < mails.length; i += 5) {
    const batch = mails.slice(i, i + 5);

    await Promise.all(batch.map(mail => sendWithBackoff(transporter, mail)));

    await delay(280); // stable, provider-friendly pace
  }
}

/* ------------------------------------------------ */

function cleanSubject(subject) {
  return (subject || "Hello")
    .replace(/\r?\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanBody(message) {
  return (message || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .trim();
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

app.post("/send", requireAuth, async (req, res) => {
  try {
    const { senderName, email, password, recipients, subject, message } = req.body;
    if (!email || !password || !recipients) return res.json({ success: false });

    const now = Date.now();
    if (!mailLimits[email] || now - mailLimits[email].start > 3600000) {
      mailLimits[email] = { count: 0, start: now };
    }

    const list = [...new Set(
      recipients.split(/[\n,]+/)
        .map(r => r.trim())
        .filter(isValidEmail)
    )];

    if (mailLimits[email].count + list.length > 27) {
      return res.json({ success: false, message: `Limit Full ❌ (${mailLimits[email].count}/27)` });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      pool: true,
      maxConnections: 1,
      maxMessages: Infinity,
      auth: { user: email, pass: password }
    });

    try { await transporter.verify(); }
    catch { return res.json({ success: false, message: "App Password Wrong ❌" }); }

    const mails = list.map(r => ({
      from: `"${senderName || "User"}" <${email}>`,
      to: r,
      subject: cleanSubject(subject),
      text: cleanBody(message),
      replyTo: email
    }));

    await sendBatch(transporter, mails);
    mailLimits[email].count += list.length;

    res.json({ success: true, message: `Mail sent ✅ (${mailLimits[email].count}/27)` });

  } catch {
    res.json({ success: false });
  }
});

app.listen(PORT, () => console.log("✅ Stable high-delivery mail server running"));
