require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

/* 🔑 Hardcoded login */
const HARD_USERNAME = "!@#$%^&*())(*&^%$#@!@#$%^&*";
const HARD_PASSWORD = "!@#$%^&*())(*&^%$#@!@#$%^&*";

/* ================= GLOBAL STATE ================= */
let mailLimits = {};
let launcherLocked = false;
const sessionStore = new session.MemoryStore();

/* ================= MIDDLEWARE ================= */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'bulk-mailer-secret',
  resave: false,
  saveUninitialized: true,
  store: sessionStore,
  cookie: { maxAge: 60 * 60 * 1000 }
}));

/* ================= RESET ================= */
function fullServerReset() {
  launcherLocked = true;
  mailLimits = {};
  sessionStore.clear(() => {});
  setTimeout(() => launcherLocked = false, 2000);
}

/* ================= AUTH ================= */
function requireAuth(req, res, next) {
  if (launcherLocked) return res.redirect('/');
  if (req.session.user) return next();
  return res.redirect('/');
}

/* ================= ROUTES ================= */
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'login.html'))
);

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (launcherLocked) return res.json({ success:false, message:"⛔ Reset in progress" });

  if (username === HARD_USERNAME && password === HARD_PASSWORD) {
    req.session.user = username;
    setTimeout(fullServerReset, 60 * 60 * 1000);
    return res.json({ success: true });
  }
  res.json({ success:false, message:"❌ Invalid credentials" });
});

app.get('/launcher', requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'launcher.html'))
);

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success:true });
  });
});

/* ================= HELPERS ================= */
const delay = ms => new Promise(r => setTimeout(r, ms));

function validEmail(e){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/* ⚡ FAST BATCH SEND (same speed as your version) */
async function sendBatch(transporter, mails, batchSize = 5) {
  for (let i = 0; i < mails.length; i += batchSize) {
    await Promise.allSettled(
      mails.slice(i, i + batchSize).map(m => transporter.sendMail(m))
    );
    await delay(300); // SAME SPEED GAP
  }
}

/* ================= SEND MAIL ================= */
app.post('/send', requireAuth, async (req, res) => {
  try {
    const { senderName, email, password, recipients, subject, message } = req.body;

    if (!email || !password || !recipients) {
      return res.json({ success:false, message:"Missing required fields" });
    }

    const now = Date.now();

    if (!mailLimits[email] || now - mailLimits[email].startTime > 3600000) {
      mailLimits[email] = { count:0, startTime:now };
    }

    const list = [...new Set(
      recipients.split(/[\n,]+/).map(r=>r.trim()).filter(validEmail)
    )];

    const HOURLY_CAP = 25; // slightly safer than 27
    if (mailLimits[email].count + list.length > HOURLY_CAP) {
      return res.json({ success:false, message:`❌ Hourly limit ${HOURLY_CAP}` });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: email, pass: password }
    });

    await transporter.verify();

    const mails = list.map(r => ({
      from: `"${senderName || 'Sender'}" <${email}>`,
      to: r,
      subject: subject || "Hello",
      text: message || "",
      replyTo: email
    }));

    await sendBatch(transporter, mails, 5);

    mailLimits[email].count += list.length;

    res.json({
      success:true,
      message:`✅ Sent ${list.length} | Used ${mailLimits[email].count}/${HOURLY_CAP}`
    });

  } catch (err) {
    res.json({ success:false, message:"❌ Sending failed" });
  }
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log(`🚀 Fast Safe Mail Launcher running on port ${PORT}`);
});
