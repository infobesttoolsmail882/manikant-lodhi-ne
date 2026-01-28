const express = require("express");
const nodemailer = require("nodemailer");
const Queue = require("bull");

const app = express();
app.use(express.json());

/* ================= MAIL CONFIG (DIRECT) ================= */
const MAIL_CONFIG = {
  host: "smtp.yourmailserver.com",   // 🔁 change
  port: 587,
  secure: false,
  auth: {
    user: "your@email.com",          // 🔁 change
    pass: "yourpassword"             // 🔁 change
  }
};

/* ================= TRANSPORTER (POOLED) ================= */
const transporter = nodemailer.createTransport({
  ...MAIL_CONFIG,
  pool: true,
  maxConnections: 3,     // controlled parallelism (safe)
  maxMessages: Infinity
});

/* ================= EMAIL QUEUE ================= */
const emailQueue = new Queue("emailQueue", {
  redis: { host: "127.0.0.1", port: 6379 }
});

/* ============ WORKER (PROCESSES EMAILS) ============ */
emailQueue.process(3, async (job) => {
  const { to, subject, text, fromName } = job.data;

  await transporter.sendMail({
    from: `"${fromName}" <${MAIL_CONFIG.auth.user}>`,
    to,
    subject,
    text
  });
});

/* ================= API TO SEND BULK ================= */
app.post("/send-bulk", async (req, res) => {
  const { recipients, subject, message, fromName } = req.body;

  if (!recipients || !subject || !message) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const list = recipients
    .split(/[\n,]+/)
    .map(e => e.trim())
    .filter(Boolean);

  for (const email of list) {
    await emailQueue.add(
      { to: email, subject, text: message, fromName },
      {
        attempts: 2,
        backoff: { type: "fixed", delay: 3000 } // retry safely
      }
    );
  }

  res.json({ queued: list.length });
});

/* ================= SERVER START ================= */
app.listen(3000, () => {
  console.log("Fast Safe Mail Server running on port 3000");
});
