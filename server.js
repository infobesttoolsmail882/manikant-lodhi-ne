import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "change-this-secret",
  resave: false,
  saveUninitialized: false
}));

/* ===== LOGIN USER ===== */
const USERNAME = "admin";
const HASHED_PASSWORD = await bcrypt.hash("2026@#", 10);

function requireLogin(req,res,next){
  if(!req.session.user) return res.status(401).json({success:false,msg:"Login required ❌"});
  next();
}

app.get("/", (req,res)=>{
  res.sendFile(path.join(__dirname,"public","login.html"));
});

app.post("/login", async (req,res)=>{
  const {username,password} = req.body;
  if(username!==USERNAME) return res.json({success:false});
  const ok = await bcrypt.compare(password,HASHED_PASSWORD);
  if(!ok) return res.json({success:false});
  req.session.user = username;
  res.json({success:true});
});

app.post("/logout",(req,res)=>{
  req.session.destroy(()=>res.json({success:true}));
});

/* ===== SECURE MAIL TRANSPORT (SERVER SIDE ONLY) ===== */
/* Use environment variables — NOT user input */
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

/* ===== SEND ROUTE ===== */
app.post("/send", requireLogin, async (req,res)=>{
  const { senderName, subject, message, to } = req.body;

  if(!subject || !message || !to)
    return res.json({success:false,msg:"All fields required ❌"});

  try {
    await transporter.sendMail({
      from: `"${senderName || "Mail System"}" <${process.env.MAIL_USER}>`,
      to,
      subject,
      text: message
    });

    res.json({success:true,msg:"Mail Sent ✅"});
  } catch(err){
    console.log(err);
    res.json({success:false,msg:"Mail send failed ❌"});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log("Secure Mail Server running"));
