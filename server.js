const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const hourlyTracker = {};
const HOURLY_LIMIT = 30; // safe cap
const DELAY = 1200; // safe delay between mails

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function canSend(email, count) {
  const now = Date.now();
  if (!hourlyTracker[email]) {
    hourlyTracker[email] = { count: 0, reset: now + 3600000 };
  }

  const data = hourlyTracker[email];

  if (now > data.reset) {
    data.count = 0;
    data.reset = now + 3600000;
  }

  return (data.count + count) <= HOURLY_LIMIT;
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

app.post("/send", async (req, res) => {
  const { senderName, gmail, appPassword, subject, message, recipients } = req.body;
  const list = recipients.split(/[\n,]+/).map(e => e.trim()).filter(Boolean);

  if (!canSend(gmail, list.length))
    return res.json({ error: "Hourly limit reached" });

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmail, pass: appPassword }
    });

    for (let to of list) {
      await transporter.sendMail({
        from: `"${senderName}" <${gmail}>`,
        to,
        subject,
        text: message + "\n\n---\nSent via Secure Mail Console"
      });
      await sleep(DELAY);
    }

    hourlyTracker[gmail].count += list.length;
    res.json({ success: true });

  } catch (err) {
    res.json({ error: "auth" });
  }
});

app.listen(3000, () => console.log("Server started"));
