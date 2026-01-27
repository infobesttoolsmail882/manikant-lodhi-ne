const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.set("trust proxy", 1);

// Fixed login
const HARD_USERNAME = "@#lodhi-ne.onrender";
const HARD_PASSWORD = "@#lodhi-ne.onrender";

app.use(bodyParser.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "lodhi_secure_session",
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 1000
  }
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
  if (username === HARD_USERNAME && password === HARD_PASSWORD) {
    req.session.user = username;
    return res.json({ success: true });
  }
  res.json({ success: false, message: "Invalid login" });
});

app.get("/launcher", requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, "public", "launcher.html"))
);

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

function cleanText(t) {
  return (t || "").replace(/\r?\n{3,}/g, "\n\n").trim();
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// SAFE SEND (one-by-one, no tricks)
app.post("/send", requireAuth, async (req, res) => {
  try {
    const { senderName, email, password, recipients, subject, message } = req.body;

    const list = recipients
      .split(/[\n,]+/)
      .map(r => r.trim())
      .filter(isValidEmail)
      .slice(0, 20); // hard safety cap

    if (!list.length) {
      return res.json({ success: false, message: "No valid recipients" });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: email, pass: password }
    });

    await transporter.verify();

    for (let to of list) {
      await transporter.sendMail({
        from: `"${senderName || email}" <${email}>`,
        to,
        subject: cleanText(subject) || "Hello",
        text: cleanText(message),
        replyTo: email
      });
      await new Promise(r => setTimeout(r, 800)); // polite delay
    }

    res.json({ success: true, message: "Mails sent successfully ✅" });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Send failed ❌" });
  }
});

app.listen(PORT, () => console.log("Server running on port", PORT));
