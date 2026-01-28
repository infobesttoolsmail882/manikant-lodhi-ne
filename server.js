import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "50kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

/* ===== SAFE LIMITS ===== */
const HOURLY_LIMIT = 15;   // lower = safer
const DELAY_MS = 1200;     // delay between each mail (human-like)

let stats = {};

setInterval(() => {
  stats = {};
  console.log("🧹 Hourly reset");
}, 60 * 60 * 1000);

/* ===== HELPERS ===== */
function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const delay = ms => new Promise(r => setTimeout(r, ms));

/* ===== SEND API ===== */
app.post("/send", async (req, res) => {
  try {
    const { senderName, gmail, apppass, to, subject, message } = req.body;

    if (!gmail || !apppass || !to || !subject || !message) {
      return res.json({ success: false, msg: "Missing fields ❌", count: 0 });
    }

    if (!stats[gmail]) stats[gmail] = { count: 0 };

    if (stats[gmail].count >= HOURLY_LIMIT) {
      return res.json({
        success: false,
        msg: "Hourly limit reached ❌",
        count: stats[gmail].count
      });
    }

    const recipients = [...new Set(
      to.split(/,|\r?\n/).map(r => r.trim()).filter(validEmail)
    )];

    const remaining = HOURLY_LIMIT - stats[gmail].count;
    if (recipients.length > remaining) {
      return res.json({
        success: false,
        msg: "Limit exceeded ❌",
        count: stats[gmail].count
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmail, pass: apppass },
      connectionTimeout: 10000
    });

    await transporter.verify();

    let sent = 0;

    for (const recipient of recipients) {
      try {
        await transporter.sendMail({
          from: `"${senderName || "Sender"}" <${gmail}>`,
          to: recipient,
          subject: subject.trim(),
          text: message.trim(),
          replyTo: gmail
        });
        sent++;
        await delay(DELAY_MS);
      } catch (err) {
        console.log("Failed for:", recipient);
      }
    }

    stats[gmail].count += sent;

    return res.json({
      success: true,
      msg: "Mail Sent ✅",
      count: stats[gmail].count
    });

  } catch (err) {
    console.error(err);
    return res.json({ success: false, msg: "Mail error ❌", count: 0 });
  }
});

/* ===== START ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Safe Mail Server running on port", PORT);
});
