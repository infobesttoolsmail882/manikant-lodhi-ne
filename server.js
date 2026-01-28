require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 8080;

const HARD_USERNAME = "mailinbox@#";
const HARD_PASSWORD = "mailinbox@#";

let mailLimits = {};
let suppressionList = new Set();
let transportCache = {};
const sessionStore = new session.MemoryStore();

app.use(helmet());
app.use(bodyParser.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "clean-mailer-secret",
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: { maxAge: 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

/* ---------- LOGIN ROUTES ---------- */

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === HARD_USERNAME && password === HARD_PASSWORD) {
    req.session.user = username;
    return res.json({ success: true });
  }
  res.json({ success: false });
});

/* ---------- PANEL ---------- */

app.get("/launcher", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "launcher.html"))
);

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

/* ---------- MAIL ENGINE ---------- */

const delay = ms => new Promise(r => setTimeout(r, ms));

async function sendWithCare(transporter, mail) {
  try {
    await transporter.sendMail(mail);
  } catch (err) {
    if (err.responseCode >= 500) suppressionList.add(mail.to);
  }
}

async function sendBatch(transporter, mails) {
  for (let i = 0; i < mails.length; i += 5) {
    await Promise.all(mails.slice(i, i + 5).map(m => sendWithCare(transporter, m)));
    if (i + 5 < mails.length) await delay(250);
  }
}

function cleanSubject(subject) {
  return (subject || "Hello").replace(/\s+/g, " ").trim();
}

function cleanBody(message) {
  return (message || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function getTransporter(email, password) {
  if (transportCache[email]) return transportCache[email];

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    pool: true,
    auth: { user: email, pass: password }
  });

  transportCache[email] = transporter;
  return transporter;
}

app.post("/send", requireAuth, async (req, res) => {
  try {
    const { senderName, email, password, recipients, subject, message } = req.body;

    const now = Date.now();
    if (!mailLimits[email] || now - mailLimits[email].start > 3600000) {
      mailLimits[email] = { count: 0, start: now };
    }

    const list = [...new Set(
      recipients.split(/[\n,]+/)
        .map(r => r.trim())
        .filter(r => isValidEmail(r) && !suppressionList.has(r))
    )];

    if (mailLimits[email].count + list.length >= 29) {
      return res.json({ success: false, message: "Limit Full ❌" });
    }

    const transporter = getTransporter(email, password);

    try {
      await transporter.verify();
    } catch {
      return res.json({ success: false, message: "App Password Wrong ❌" });
    }

    const mails = list.map(r => ({
      from: `"${senderName || "User"}" <${email}>`,
      to: r,
      subject: cleanSubject(subject),
      text: cleanBody(message),
      replyTo: email
    }));

    await sendBatch(transporter, mails);
    mailLimits[email].count += list.length;

    res.json({ success: true, message: `Mail sent ✅ (${mailLimits[email].count}/28)` });

  } catch {
    res.json({ success: false, message: "Sending failed" });
  }
});

app.listen(PORT, () => console.log("✅ Server running"));
