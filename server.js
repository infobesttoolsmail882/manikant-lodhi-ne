import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

/* ROOT */
app.get("/", (req, res) => {
  const p = path.join(__dirname, "public", "login.html");
  res.sendFile(p, err => {
    if (err) res.status(404).send("login.html not found");
  });
});

/* SPEED CONFIG (UNCHANGED) */
const HOURLY_LIMIT = 28;
const PARALLEL = 3;
const DELAY_MS = 120;

let stats = {};

/* AUTO RESET */
setInterval(() => {
  stats = {};
  console.log("🧹 Hourly reset → Gmail limits cleared");
}, 60 * 60 * 1000);

/* SAFE SUBJECT */
function safeSubject(subject = "") {
  return subject
    .replace(/\s{2,}/g, " ")
    .replace(/([!?])\1+/g, "$1")
    .replace(/^[A-Z\s]+$/, s => s.toLowerCase())
    .replace(/free|urgent|act now|guarantee/gi, "")
    .trim()
    .slice(0, 150);
}

/* SAFE BODY */
function safeBody(text = "") {
  let t = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 5000);

  const soften = [
    ["report", "the report details are shared below"],
    ["price", "the pricing details are included below"],
    ["quote", "the quoted details are mentioned below"],
    ["proposal", "the proposal details are outlined below"],
    ["screenshot", "a screenshot has been included for reference"]
  ];

  soften.forEach(([word, line]) => {
    const re = new RegExp(`(^|\\n)\\s*${word}\\s*(?=\\n|$)`, "gi");
    t = t.replace(re, `$1${line}`);
  });

  return t;
}

/* SAFE PARALLEL SENDER */
async function sendSafely(transporter, mails) {
  let sent = 0;

  for (let i = 0; i < mails.length; i += PARALLEL) {
    const batch = mails.slice(i, i + PARALLEL);

    const results = await Promise.allSettled(
      batch.map(m => transporter.sendMail(m))
    );

    results.forEach(r => {
      if (r.status === "fulfilled") sent++;
      else console.log("Send fail:", r.reason?.message);
    });

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  return sent;
}

/* SEND API */
app.post("/send", async (req, res) => {
  const { senderName, gmail, apppass, to, subject, message } = req.body;

  if (!gmail || !apppass || !to || !subject || !message) {
    return res.json({ success: false, msg: "Missing Fields ❌", count: 0 });
  }

  if (!gmail.includes("@") || gmail.length > 100) {
    return res.json({ success: false, msg: "Invalid Gmail ❌", count: 0 });
  }

  if (!stats[gmail]) stats[gmail] = { count: 0 };

  if (stats[gmail].count >= HOURLY_LIMIT) {
    return res.json({
      success: false,
      msg: "This Gmail ID hourly limit reached ❌",
      count: stats[gmail].count
    });
  }

  const recipients = to
    .split(/,|\r?\n/)
    .map(r => r.trim())
    .filter(r => r.includes("@") && r.length < 150);

  const remaining = HOURLY_LIMIT - stats[gmail].count;
  if (recipients.length > remaining) {
    return res.json({
      success: false,
      msg: "This Gmail ID limit full ❌",
      count: stats[gmail].count
    });
  }

  const finalSubject = safeSubject(subject);
  const finalText = safeBody(message) + "\n\nScanned & secured";

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: gmail, pass: apppass },
    tls: { rejectUnauthorized: true }
  });

  try {
    await transporter.verify();
    console.log("SMTP Ready ✅");
  } catch (err) {
    console.log("SMTP ERROR:", err.message);
    return res.json({
      success: false,
      msg: "Mail login failed ❌",
      count: stats[gmail].count
    });
  }

  const mails = recipients.map(r => ({
    from: `"${senderName || "Mail Sender"}" <${gmail}>`,
    to: r,
    subject: finalSubject,
    text: finalText,
    replyTo: gmail
  }));

  const sent = await sendSafely(transporter, mails);
  stats[gmail].count += sent;

  return res.json({
    success: true,
    sent,
    count: stats[gmail].count
  });
});

/* START SERVER */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ SAFE Mail Server running on port", PORT);
});
