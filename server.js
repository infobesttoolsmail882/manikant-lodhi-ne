require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 8080;

/* ===== BASIC LOGIN (CHANGE THESE) ===== */
const USERNAME = "mailinbox@#";
const PASSWORD = "mailinbox@#";

/* ===== MIDDLEWARE ===== */
app.use(helmet());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "secure-mail-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 }
}));

/* ===== AUTH CHECK ===== */
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

/* ===== LOGIN ROUTES ===== */
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

/* ===== PANEL ===== */
app.get("/panel", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "panel.html"))
);

/* ===== SAFE EMAIL SENDING (INDIVIDUAL USE) ===== */
app.post("/send", requireAuth, async (req, res) => {
  try {
    const { email, password, to, subject, message } = req.body;

    if (!email || !password || !to) {
      return res.json({ success: false, message: "Missing fields" });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: email, pass: password }
    });

    try {
      await transporter.verify();
    } catch {
      return res.json({ success: false, message: "App Password Wrong ❌" });
    }

    await transporter.sendMail({
      from: email,
      to,
      subject: subject || "Hello",
      text: message || ""
    });

    res.json({ success: true, message: "Mail sent ✅" });

  } catch (err) {
    res.json({ success: false, message: "Sending failed" });
  }
});

/* ===== START ===== */
app.listen(PORT, () => console.log("✅ Server running safely"));
