import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ⛔ Abuse rokne ke liye basic rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20 // ek IP se 20 requests max
});
app.use(limiter);

// ✅ Gmail SMTP Transport (App Password required)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,      // your gmail
    pass: process.env.EMAIL_PASS       // gmail app password
  }
});

// Server health check
app.get("/", (req, res) => {
  res.send("Mail server running ✅");
});

// 📩 Send mail API
app.post("/send-email", async (req, res) => {
  try {
    const { to, subject, text } = req.body;

    if (!to || !subject || !text) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const mailOptions = {
      from: `"Mail Dispatch" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Mail sent:", info.messageId);
    res.json({ success: true, messageId: info.messageId });

  } catch (error) {
    console.error("Mail error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
