async function sendEmails() {
  const btn = document.getElementById("sendBtn");
  btn.disabled = true;
  status.innerText = "Sending...";

  const data = {
    senderName: senderName.value,
    gmail: gmail.value,
    appPassword: appPassword.value,
    subject: subject.value,
    message: message.value,
    recipients: recipients.value
  };

  const res = await fetch("/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const result = await res.json();

  if (result.success) {
    status.innerText = "Mail sent ✅";
  } else if (result.error === "auth") {
    status.innerText = "Not ☒ (Wrong App Password)";
  } else {
    status.innerText = result.error;
  }

  btn.disabled = false;
}

function logout() {
  window.location = "login.html";
}
