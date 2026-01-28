require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 8080;

/* 🔐 LOGIN ID PASS */
const USERNAME = "mailinbox@#";
const PASSWORD = "mailinbox@#";

/* 🛡 Security */
app.use(helmet({ contentSecurityPolicy: false }));

/* 📦 Middlewares */
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "secure-mail-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 }
}));

/* 🔒 Auth Check */
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

/* 🔑 LOGIN ROUTES */
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === USERNAME && password === PASSWORD) {
    req.session.user = username;
    return res.json({ success: true });
  }
  res.json({ success: false });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

/* 🟢 ✅ PANEL ROUTE — FIX FOR NOT FOUND */
app.get("/panel", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "panel.html"));
});

/* 📧 EMAIL SEND (single mail safe) */
app.post("/send", requireAuth, async (req, res) => {
  try {
    const { email, password, to, subject, message } = req.body;

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: email, pass: password }
    });

    await transporter.verify();

    await transporter.sendMail({
      from: email,
      to,
      subject: subject || "Hello",
      text: message || ""
    });

    res.json({ success: true, message: "Mail sent ✅" });
  } catch {
    res.json({ success: false, message: "App Password Wrong ❌" });
  }
});

/* 🚀 Start Server */
app.listen(PORT, () => console.log("✅ Server running with /panel working"));
