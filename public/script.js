const sendBtn = document.getElementById("sendBtn");
const statusBox = document.getElementById("status");

sendBtn.onclick = async () => {
  sendBtn.disabled = true;
  sendBtn.textContent = "Sending...";

  const res = await fetch("/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      senderName: senderName.value,
      email: email.value,
      password: password.value,
      subject: subject.value,
      message: message.value,
      recipients: recipients.value
    })
  });

  const data = await res.json();

  sendBtn.disabled = false;
  sendBtn.textContent = "Send All";

  if (data.success) alert("Mails Sent ✅");
  else alert(data.message);

  statusBox.textContent = data.limitInfo || "0 / 28";
};

function logout(){
  fetch("/logout",{method:"POST"}).then(()=>location.href="/");
}
