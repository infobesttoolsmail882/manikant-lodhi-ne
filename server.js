const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const PORT = 3000;

// per email hourly limit store
const hourlyTracker = {};

function canSend(email, count) {
  const now = Date.now();
  if (!hourlyTracker[email]) {
    hourlyTracker[email] = { count: 0, reset: now + 3600000 };
  }

  const user = hourlyTracker[email];

  if (now > user.reset) {
    user.count = 0;
    user.reset = now + 3600000;
  }

  return (user.count + count) <= 30; // SAFE HOURLY CAP
}

function addCount(email, count) {
  hourlyTracker[email].count += count;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

app.post("/send", async (req, res) => {
  const { senderName, gmail, appPassword, subject, message, recipients } = req.body;

  const list = recipients.split(/[\n,]+/).map(e => e.trim()).filter(Boolean);

  if (!canSend(gmail, list.length)) {
    return res.json({ error: "Hourly limit reached. Try later." });
  }

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
        text: message + "\n\n—\nThis email was sent via Secure Mail Console"
      });

      await sleep(1500); // SAFE DELAY (important)
    }

    addCount(gmail, list.length);
    res.json({ success: true });

  } catch (err) {
    res.json({ error: "Authentication failed or sending blocked." });
  }
});

app.listen(PORT, () => console.log("Running on port " + PORT));
