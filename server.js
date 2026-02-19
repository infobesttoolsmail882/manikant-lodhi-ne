import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import nodemailer from 'nodemailer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import validator from 'validator';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// ================= SECURITY =================

app.use(helmet());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 1000
  }
}));

// ================= RATE LIMIT =================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});

const sendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 25
});

app.use(express.static(path.join(__dirname, 'public')));

// ================= AUTH =================

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/');
  next();
}

// ================= LOGIN =================

app.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (username !== process.env.ADMIN_USER)
    return res.json({ success: false });

  const match = await bcrypt.compare(password, process.env.ADMIN_PASS_HASH);

  if (!match)
    return res.json({ success: false });

  req.session.user = username;
  res.json({ success: true });
});

// ================= SEND =================

app.post('/send', requireAuth, sendLimiter, async (req, res) => {
  try {
    const { senderName, email, appPassword, recipients, subject, message } = req.body;

    if (!validator.isEmail(email))
      return res.json({ success: false, message: "Invalid sender email" });

    const recipientList = recipients
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(r => validator.isEmail(r));

    if (recipientList.length === 0)
      return res.json({ success: false, message: "No valid recipients" });

    if (recipientList.length > 25)
      return res.json({ success: false, message: "Max 25 per hour allowed" });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: email, pass: appPassword }
    });

    for (const r of recipientList) {
      await transporter.sendMail({
        from: `"${senderName || "Mailer"}" <${email}>`,
        to: r,
        subject: subject || "Notification",
        text: message || ""
      });

      await new Promise(res => setTimeout(res, 800));
    }

    res.json({ success: true, message: "Emails sent safely" });

  } catch (err) {
    res.json({ success: false, message: "Send failed" });
  }
});

// ================= START =================

app.listen(PORT, () => {
  console.log(`🚀 Safe Mail Launcher running on ${PORT}`);
});
