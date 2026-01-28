const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

/* ===== LIMIT TRACKING ===== */
let stats = {};
const HOURLY_LIMIT = 28;

/* ===== HELPERS ===== */
const delay = ms => new Promise(r => setTimeout(r, ms));

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* SAME SPEED: 5 parallel + 300ms */
async function sendBatch(transporter, mails) {
  let sent = 0;

  for (let i = 0; i < mails.length; i += 5) {
    const batch = mails.slice(i, i + 5);

    const results = await Promise.allSettled(
      batch.map(m => transporter.sendMail(m))
    );

    results.forEach(r => {
      if (r.status === "fulfilled") sent++;
    });

    await delay(300);
  }

  return sent;
}

/* ===== SEND ROUTE ===== */
app.post("/send", async (req, res) => {
  try {
    // ⬇️ FIELD NAMES MATCH FRONTEND
    const { sender, gmail, appPassword, subject, body, recipients } = req.body;

    if (!sender || !gmail || !appPassword || !subject || !body || !recipients) {
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

    const list = [...new Set(
      recipients.split(/[\n,]+/)
        .map(r => r.trim())
        .filter(validEmail)
    )];

    const remaining = HOURLY_LIMIT - stats[gmail].count;
    if (list.length > remaining) {
      return res.json({
        success: false,
        msg: "Limit exceeded ❌",
        count: stats[gmail].count
      });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmail, pass: appPassword },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    await transporter.verify();

    const mails = list.map(to => ({
      from: `"${sender}" <${gmail}>`,
      to,
      subject,
      text: body,
      replyTo: gmail
    }));

    const sent = await sendBatch(transporter, mails);
    stats[gmail].count += sent;

    return res.json({
      success: true,
      msg: "Mail Sent ✅",
      count: stats[gmail].count
    });

  } catch (err) {
    console.error("MAIL ERROR:", err.message);
    return res.json({
      success: false,
      msg: "Mail sending failed ❌",
      count: 0
    });
  }
});

app.listen(PORT, () => {
  console.log("🚀 Mail server running on port", PORT);
});
