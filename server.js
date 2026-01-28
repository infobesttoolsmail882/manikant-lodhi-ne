const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json()); // IMPORTANT
app.use(express.static(path.join(__dirname, "public")));

let stats = {};
const HOURLY_LIMIT = 28;

const delay = ms => new Promise(r => setTimeout(r, ms));

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendBatch(transporter, mails) {
  let sent = 0;
  for (let i = 0; i < mails.length; i += 5) {
    const batch = mails.slice(i, i + 5);
    const results = await Promise.allSettled(batch.map(m => transporter.sendMail(m)));
    results.forEach(r => { if (r.status === "fulfilled") sent++; });
    await delay(300);
  }
  return sent;
}

app.post("/send", async (req, res) => {
  try {
    const { sender, gmail, appPassword, subject, body, recipients } = req.body;

    console.log("REQ BODY:", req.body); // DEBUG LINE

    if (!sender || !gmail || !appPassword || !subject || !body || !recipients) {
      return res.json({ success:false, msg:"Missing Fields ❌", count:0 });
    }

    if (!stats[gmail]) stats[gmail] = { count: 0 };

    if (stats[gmail].count >= HOURLY_LIMIT) {
      return res.json({ success:false, msg:"Hourly limit reached ❌", count:stats[gmail].count });
    }

    const list = [...new Set(
      recipients.split(/[\n,]+/).map(r=>r.trim()).filter(validEmail)
    )];

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmail, pass: appPassword }
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

    return res.json({ success:true, msg:"Mail Sent ✅", count:stats[gmail].count });

  } catch (err) {
    console.error(err);
    return res.json({ success:false, msg:"Mail sending failed ❌", count:0 });
  }
});

app.listen(PORT, () => console.log("🚀 Server running on", PORT));
