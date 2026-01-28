const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

/* ================= LOGIN ================= */
const HARD_USERNAME = "!@#$%^&*())(*&^%$#@!@#$%^&*";
const HARD_PASSWORD = "!@#$%^&*())(*&^%$#@!@#$%^&*";

/* ================= GLOBAL ================= */
let mailLimits = {};
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

/* ================= AUTH ================= */
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  return res.redirect('/');
}

/* ================= ROUTES ================= */
app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'login.html'))
);

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === HARD_USERNAME && password === HARD_PASSWORD) {
    req.session.user = username;
    return res.json({ success: true });
  }
  res.json({ success:false });
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

/* ================= SEND MAIL ================= */
app.post('/send', requireAuth, async (req, res) => {
  try {
    const { senderName, email, password, recipients, subject, message } = req.body;

    if (!email || !password || !recipients)
      return res.json({ success:false, message:"Missing fields" });

    /* Hourly limit */
    const now = Date.now();
    if (!mailLimits[email] || now - mailLimits[email].time > 3600000)
      mailLimits[email] = { count:0, time:now };

    const list = [...new Set(
      recipients.split(/[\n,]+/).map(r=>r.trim()).filter(validEmail)
    )];

    const HOURLY_CAP = 15;
    if (mailLimits[email].count + list.length > HOURLY_CAP)
      return res.json({ success:false, message:"Hourly limit reached" });

    /* Stable Gmail transporter */
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: email, pass: password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    await transporter.verify();

    let sent = 0;

    for (const to of list) {
      try {
        await transporter.sendMail({
          from: `"${senderName || 'Sender'}" <${email}>`,
          to,
          subject: subject || "Hello",
          text: message || "",
          replyTo: email
        });
        sent++;
        await delay(1000); // natural gap prevents blocking
      } catch (err) {
        console.log("Mail fail:", to, err.message);
      }
    }

    mailLimits[email].count += sent;

    return res.json({
      success:true,
      message:`✅ Sent ${sent} emails`
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.json({
      success:false,
      message:"Mail server error ❌"
    });
  }
});

/* ================= GLOBAL ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("Unhandled:", err);
  res.status(500).json({ success:false, message:"Unexpected server error" });
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log(`🚀 Mail Launcher running on port ${PORT}`);
});
