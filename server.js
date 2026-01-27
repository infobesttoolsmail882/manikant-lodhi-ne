const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.set("trust proxy", 1);

const PANEL_USER = "@#lodhi-ne.onrender";
const PANEL_PASS = "@#lodhi-ne.onrender";

let hourlyLimits = {}; // { email: { count, start } }

app.use(bodyParser.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "secure_session_key",
  resave: false,
  saveUninitialized: true,
  cookie: { httpOnly: true, secure: false, sameSite: "lax", maxAge: 3600000 }
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
  if (username === PANEL_USER && password === PANEL_PASS) {
    req.session.user = username;
    return res.json({ success: true });
  }
  res.json({ success: false, message: "Invalid login" });
});

app.get("/launcher", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "launcher.html"))
);

app.post("/logout", (req, res) =>
  req.session.destroy(() => res.json({ success: true }))
);

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

const delay = ms => new Promise(r => setTimeout(r, ms));

app.post("/send", requireAuth, async (req, res) => {
  try {
    const { senderName, email, password, recipients, subject, message } = req.body;

    if (!isValidEmail(email) || !password) {
      return res.json({ success: false, message: "Invalid email details" });
    }

    const now = Date.now();
    if (!hourlyLimits[email] || now - hourlyLimits[email].start > 3600000) {
      hourlyLimits[email] = { count: 0, start: now };
    }

    const list = recipients
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(isValidEmail);

    if (hourlyLimits[email].count + list.length > 28) {
      return res.json({
        success: false,
        message: "Hourly limit reached (28)",
        limitInfo: `${hourlyLimits[email].count}/28 used`
      });
    }

    // 🔥 Connection pooling = faster but still safe
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      pool: true,
      maxConnections: 2,
      maxMessages: 50,
      auth: { user: email, pass: password }
    });

    try {
      await transporter.verify();
    } catch {
      return res.json({ success: false, message: "App Password ❌" });
    }

    for (const to of list) {
      await transporter.sendMail({
        from: `"${senderName || email}" <${email}>`,
        to,
        subject: subject || "Hello",
        text: message || "",
        replyTo: email
      });

      hourlyLimits[email].count++;

      // ⚡ 250ms = practical fast but still human-like
      await delay(250);
    }

    res.json({
      success: true,
      limitInfo: `${hourlyLimits[email].count}/28 used`
    });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Send failed ❌" });
  }
});

app.listen(PORT, () => console.log("Server running on port", PORT));
