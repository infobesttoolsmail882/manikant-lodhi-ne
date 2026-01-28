const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 🚦 SAFETY LIMITS
const MAX_RECIPIENTS_PER_REQUEST = 50; // prevent abuse
const DELAY_BETWEEN_EMAILS_MS = 2000;  // 2 sec gap (important!)

app.post("/send", async (req, res) => {
  try {
    const {
      senderName,
      gmail,
      appPassword,
      subject,
      message,
      recipients
    } = req.body;

    if (!gmail || !appPassword)
      return res.status(400).json({ error: "Email credentials required" });

    const list = recipients
      .split(/[\n,]+/)
      .map(e => e.trim())
      .filter(e => e);

    if (list.length === 0)
      return res.status(400).json({ error: "Recipient list empty" });

    if (list.length > MAX_RECIPIENTS_PER_REQUEST)
      return res.status(400).json({ error: "Too many recipients at once" });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmail,
        pass: appPassword
      }
    });

    let sent = 0;

    for (const to of list) {
      await transporter.sendMail({
        from: `"${senderName}" <${gmail}>`,
        to,
        subject,
        text: message,
        headers: {
          "List-Unsubscribe": `<mailto:${gmail}?subject=unsubscribe>`
        }
      });

      sent++;
      await sleep(DELAY_BETWEEN_EMAILS_MS); // slow sending = safer
    }

    res.json({ success: true, sent });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sending failed", detail: err.message });
  }
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
