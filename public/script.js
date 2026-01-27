const sendBtn = document.getElementById("sendBtn");
const statusBox = document.getElementById("status");

sendBtn.onclick = async () => {
  sendBtn.disabled = true;
  sendBtn.textContent = "Sending...";
  statusBox.textContent = "";

  const res = await fetch("/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      senderName: senderName.value,
      email: email.value,
      password: password.value,
      subject: subject.value,
      message: message.value,
      recipient: recipient.value
    })
  });

  const data = await res.json();
  statusBox.textContent = data.message;

  sendBtn.disabled = false;
  sendBtn.textContent = "Send";
};

function logout() {
  fetch("/logout", { method: "POST" })
    .then(() => location.href = "/");
}
