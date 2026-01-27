const express = require("express");
const session = require("express-session");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const PORT = 8080;

// 🔐 Login (as you requested)
const PANEL_USER = "mailinbox@#";
const PANEL_PASS = "mailinbox@#";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "secure-session-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 }
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
  res.json({ success: false });
});

app.get("/launcher", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "launcher.html"))
);

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ================= SEND MAIL =================
app.post("/send", requireAuth, async (req, res) => {
  try {
    const { senderName, email, password, recipients, subject, message } = req.body;

    if (!senderName || !email || !password || !recipients || !subject || !message) {
      return res.json({ success: false, message: "Missing fields" });
    }

    const list = recipients
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(r => r.includes("@"));

    if (list.length === 0) {
      return res.json({ success: false, message: "No valid recipients" });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: email, pass: password }
    });

    await transporter.verify();

    for (const r of list) {
      await transporter.sendMail({
        from: `"${senderName}" <${email}>`,
        to: r,
        subject: subject.trim(),
        text: message.trim(),
        replyTo: email
      });
    }

    res.json({ success: true, message: "Mail Sent Successfully" });

  } catch {
    res.json({ success: false, message: "App Password Wrong ❌" });
  }
});

app.listen(PORT, () =>
  console.log("Safe mail panel running on port", PORT)
);
