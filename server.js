import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

/* SAME SPEED */
const HOURLY_LIMIT = 28;
const PARALLEL = 3;
const DELAY_MS = 120;

let stats = {};
setInterval(() => { stats = {}; }, 60 * 60 * 1000);

/* Clean Subject */
const safeSubject = s =>
  (s || "").replace(/\s+/g, " ").trim().slice(0, 150);

/* Clean Body */
const safeBody = t =>
  (t || "").replace(/\r\n/g, "\n").trim().slice(0, 5000);

/* Controlled parallel sending */
async function sendSafely(transporter, mails) {
  let sent = 0;
  for (let i = 0; i < mails.length; i += PARALLEL) {
    const batch = mails.slice(i, i + PARALLEL);
    const results = await Promise.allSettled(batch.map(m => transporter.sendMail(m)));
    results.forEach(r => { if (r.status === "fulfilled") sent++; });
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  return sent;
}

app.post("/send", async (req, res) => {
  const { senderName, gmail, apppass, to, subject, message } = req.body;

  if (!gmail || !apppass || !to || !subject || !message)
    return res.json({ success: false, msg: "Missing fields ❌" });

  if (!stats[gmail]) stats[gmail] = { count: 0 };
  if (stats[gmail].count >= HOURLY_LIMIT)
    return res.json({ success: false, msg: "Hourly limit reached ❌" });

  const recipients = to.split(/,|\n/).map(r => r.trim()).filter(r => r.includes("@"));
  const remaining = HOURLY_LIMIT - stats[gmail].count;
  if (recipients.length > remaining)
    return res.json({ success: false, msg: "Limit full for this Gmail ❌" });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmail, pass: apppass }
  });

  try { await transporter.verify(); }
  catch { return res.json({ success: false, msg: "Gmail login failed ❌" }); }

  const mails = recipients.map(r => ({
    from: `"${senderName || gmail}" <${gmail}>`,
    to: r,
    subject: safeSubject(subject),
    text: safeBody(message),
    headers: { "X-Mailer": "NodeMailer" } // normal header, not spammy
  }));

  const sent = await sendSafely(transporter, mails);
  stats[gmail].count += sent;

  res.json({ success: true, sent });
});

app.listen(process.env.PORT || 3000, () =>
  console.log("✅ Mail server running")
);
