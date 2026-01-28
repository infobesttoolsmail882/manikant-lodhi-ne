const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const LOGIN_USER = "admin";
const LOGIN_PASS = "lodhi882@#";

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === LOGIN_USER && password === LOGIN_PASS) {
    res.redirect("/launcher.html");
  } else {
    res.send("Invalid credentials");
  }
});

app.post("/send", async (req, res) => {
  const { senderName, gmail, appPassword, subject, message, recipients } = req.body;
  const recipientList = recipients.split(/,|\n/).map(r => r.trim()).filter(r => r);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmail,
      pass: appPassword
    }
  });

  // Send all emails in parallel for speed
  const sendPromises = recipientList.map(to =>
    transporter.sendMail({
      from: `"${senderName}" <${gmail}>`,
      to,
      subject,
      text: message
    }).then(() => ({ to, status: "sent" }))
      .catch(err => ({ to, status: "failed", error: err.message }))
  );

  const results = await Promise.all(sendPromises);
  const sentCount = results.filter(r => r.status === "sent").length;

  res.send(`Sent ${sentCount}/${recipientList.length} emails.`);
});

app.listen(3000, () => console.log("Server running on port 3000"));
