import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ===== ROOT ===== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

/* ===== SPEED CONFIG (UNCHANGED) ===== */
const HOURLY_LIMIT = 28;
const PARALLEL = 3;
const DELAY_MS = 120;

/* ===== STATS STORE ===== */
let stats = {};

/* 🔁 RESET EVERY HOUR */
setInterval(() => {
  stats = {};
  console.log("🧹 Hourly reset → limits cleared");
}, 60 * 60 * 1000);

/* ===== BASIC EMAIL VALIDATION ===== */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ===== SAFE SEND ENGINE ===== */
async function sendSafely(transporter, mails) {
  let sent = 0;

  for (let i = 0; i < mails.length; i += PARALLEL) {
    const batch = mails.slice(i, i + PARALLEL);

    const results = await Promise.allSettled(
      batch.map(mail => transporter.sendMail(mail))
    );

    results.forEach(r => {
      if (r.status === "fulfilled") sent++;
    });

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  return sent;
}

/* ===== SEND API ===== */
app.post("/send", async (req, res) => {
  try {
    const { senderName, gmail, apppass, to, subject, message } = req.body;

    if (!gmail || !apppass || !to || !subject || !message) {
      return res.json({ success: false, msg: "Missing Fields ❌", count: 0 });
    }

    if (!stats[gmail]) stats[gmail] = { count: 0 };

    if (stats[gmail].count >= HOURLY_LIMIT) {
      return res.json({
        success: false,
        msg: "Hourly limit reached ❌",
        count: stats[gmail].count
      });
    }

    const recipients = to
      .split(/,|\r?\n/)
      .map(r => r.trim())
      .filter(isValidEmail);

    const remaining = HOURLY_LIMIT - stats[gmail].count;
    if (recipients.length > remaining) {
      return res.json({
        success: false,
        msg: "Gmail hourly quota full ❌",
        count: stats[gmail].count
      });
    }

    /* Transport with pooling (faster, stable) */
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmail, pass: apppass },
      pool: true,
      maxConnections: 2,
      maxMessages: Infinity
    });

    await transporter.verify();

    const mails = recipients.map(r => ({
      from: `"${senderName || "Sender"}" <${gmail}>`,
      to: r,
      subject: subject.trim(),
      text: message.trim(),
      replyTo: gmail
    }));

    const sent = await sendSafely(transporter, mails);
    stats[gmail].count += sent;

    return res.json({
      success: true,
      sent,
      count: stats[gmail].count
    });

  } catch (err) {
    console.error("Send error:", err.message);
    return res.json({ success: false, msg: "Wrong App Password ❌", count: 0 });
  }
});

/* ===== START ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Mail Server running on port", PORT);
});
