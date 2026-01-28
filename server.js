import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

/* ================= SPEED SETTINGS ================= */
/* (As requested — kept same) */
const HOURLY_LIMIT = 28;     // per sender
const PARALLEL = 3;          // 3 emails at once
const DELAY_MS = 120;        // 120ms gap between batches

/* Track per-sender hourly usage */
let stats = {};

/* Auto reset every hour */
setInterval(() => {
  stats = {};
  console.log("🧹 Hourly reset — usage cleared");
}, 60 * 60 * 1000);

/* ================= HELPERS ================= */

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* Parallel controlled sender */
async function sendInBatches(transporter, mails) {
  let sent = 0;

  for (let i = 0; i < mails.length; i += PARALLEL) {
    const batch = mails.slice(i, i + PARALLEL);

    const results = await Promise.allSettled(
      batch.map(mail => transporter.sendMail(mail))
    );

    results.forEach(r => {
      if (r.status === "fulfilled") sent++;
    });

    await sleep(DELAY_MS);
  }

  return sent;
}

/* ================= SEND ROUTE ================= */
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

    const recipients = [...new Set(
      to.split(/,|\r?\n/)
        .map(r => r.trim())
        .filter(isValidEmail)
    )];

    const remaining = HOURLY_LIMIT - stats[gmail].count;
    if (recipients.length > remaining) {
      return res.json({
        success: false,
        msg: "Sender hourly quota full ❌",
        count: stats[gmail].count
      });
    }

    /* Stable pooled connection */
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
      replyTo: gmail,
      headers: {
        "List-Unsubscribe": `<mailto:${gmail}?subject=unsubscribe>`
      }
    }));

    const sent = await sendInBatches(transporter, mails);
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

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ Safe Mail Server running on port", PORT);
});
