require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 8080;

/* 🔑 Hardcoded login (still recommend env in real apps) */
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
  cookie: {
    maxAge: 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax"
  }
}));

/* 🚦 Basic abuse protection */
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const sendLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });

app.use('/login', loginLimiter);
app.use('/send', sendLimiter);

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

/* Human-like safe sending */
async function sendSafely(transporter, mails) {
  let sent = 0;
  for (let i = 0; i < mails.length; i++) {
    try {
      await transporter.sendMail(mails[i]);
      sent++;
    } catch {}
    await delay(800);               // natural gap
    if ((i+1) % 5 === 0) await delay(3000); // longer pause
  }
  return sent;
}

/* ================= SEND MAIL ================= */
app.post('/send', requireAuth, async (req, res) => {
  try {
    const { senderName, email, password, recipients, subject, message } = req.body;
    if (!email || !password || !recipients)
      return res.json({ success:false, message:"Missing required fields" });

    const now = Date.now();
    if (!mailLimits[email] || now - mailLimits[email].startTime > 3600000)
      mailLimits[email] = { count:0, startTime:now };

    const list = [...new Set(
      recipients.split(/[\n,]+/).map(r=>r.trim()).filter(validEmail)
    )];

    const HOURLY_CAP = 20;
    if (mailLimits[email].count + list.length > HOURLY_CAP)
      return res.json({ success:false, message:`❌ Hourly limit ${HOURLY_CAP}` });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: email, pass: password }
    });

    await transporter.verify();

    const mails = list.map(r => ({
      from: `"${senderName || 'Sender'}" <${email}>`,
      to: r,
      subject: subject || "Hello",
      text: message || "",
      replyTo: email,
      headers: {
        "List-Unsubscribe": `<mailto:${email}?subject=unsubscribe>`
      }
    }));

    const sent = await sendSafely(transporter, mails);
    mailLimits[email].count += sent;

    res.json({ success:true, message:`✅ Sent ${sent}` });

  } catch (err) {
    res.json({ success:false, message:"❌ Sending failed" });
  }
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log(`🚀 Safe Mail Launcher running on port ${PORT}`);
});
