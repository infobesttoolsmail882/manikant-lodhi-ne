const express = require("express");
const session = require("express-session");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const PORT = 8080;

// 🔐 PANEL LOGIN (as requested)
const PANEL_USER = "mailinbox@#";
const PANEL_PASS = "mailinbox@#";

// 📧 SMTP (Use your real Gmail + App Password)
const SMTP_USER = "yourgmail@gmail.com";
const SMTP_PASS = "yourapppassword";

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

// Mail transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user: SMTP_USER, pass: SMTP_PASS }
});

app.post("/send", requireAuth, async (req, res) => {
  try {
    const { senderName, to, subject, message } = req.body;

    if (!to || !subject || !message) {
      return res.json({ success: false, message: "Missing fields" });
    }

    await transporter.verify();

    await transporter.sendMail({
      from: `"${senderName || "Support"}" <${SMTP_USER}>`,
      to,
      subject: subject.trim(),
      text: message.trim(),
      replyTo: SMTP_USER
    });

    res.json({ success: true, message: "Email sent successfully" });

  } catch {
    res.json({ success: false, message: "Send failed" });
  }
});

app.listen(PORT, () =>
  console.log("Secure mail panel running on port", PORT)
);
