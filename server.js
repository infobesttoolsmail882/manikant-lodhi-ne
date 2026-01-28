const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

/* ================= LIMIT CONTROL ================= */
let mailLimits = {};

/* ================= HELPERS ================= */
const delay = ms => new Promise(r => setTimeout(r, ms));

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* SAME SPEED FUNCTION (5 parallel, 300ms gap) */
async function sendBatch(transporter, mails, batchSize = 5) {
  for (let i = 0; i < mails.length; i += batchSize) {
    const batch = mails.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(mail => transporter.sendMail(mail)));
    await delay(300);
  }
}

/* ================= SEND ROUTE ================= */
app.post("/send", async (req, res) => {
  try {
    const { senderName, email, password, recipients, subject, message } = req.body;

    if (!email || !password || !recipients)
      return res.json({ success: false, message: "Missing fields" });

    const now = Date.now();

    if (!mailLimits[email] || now - mailLimits[email].time > 3600000) {
      mailLimits[email] = { count: 0, time: now };
    }

    const list = [...new Set(
      recipients.split(/[\n,]+/)
        .map(r => r.trim())
        .filter(validEmail)
    )];

    const HOURLY_CAP = 25;
    if (mailLimits[email].count + list.length > HOURLY_CAP)
      return res.json({ success: false, message: "Hourly limit reached" });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: email, pass: password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    await transporter.verify();

    const mails = list.map(to => ({
      from: `"${senderName || "Sender"}" <${email}>`,
      to,
      subject: subject || "Hello",
      text: message || "",
      replyTo: email
    }));

    await sendBatch(transporter, mails, 5);

    mailLimits[email].count += list.length;

    return res.json({
      success: true,
      message: `✅ Sent ${list.length} emails`
    });

  } catch (err) {
    console.error("MAIL ERROR:", err.message);
    return res.json({ success: false, message: "Mail sending failed ❌" });
  }
});

/* ================= FAIL SAFE ================= */
process.on("unhandledRejection", err => {
  console.error("Unhandled rejection:", err);
});

app.listen(PORT, () => {
  console.log(`🚀 Mail server running on port ${PORT}`);
});
