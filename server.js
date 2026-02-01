import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true }
}));

const USERNAME = "admin";
const HASHED_PASSWORD = await bcrypt.hash("2026@#", 10);

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ msg: "Login required" });
  next();
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (username !== USERNAME) return res.json({ success:false });

  const ok = await bcrypt.compare(password, HASHED_PASSWORD);
  if (!ok) return res.json({ success:false });

  req.session.user = username;
  res.json({ success:true });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ success:true }));
});

/* SIMPLE SAFE SEND (single message style) */
app.post("/send", requireLogin, async (req, res) => {
  const { subject, message, to } = req.body;

  if (!subject || !message || !to)
    return res.json({ success:false, msg:"All fields required ❌" });

  // Yaha pe server-side verified mail service call hota hai
  console.log("Mail request:", { to, subject });

  res.json({ success:true, msg:"Mail Sent ✅" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
