async function sendEmails() {
  const btn = document.getElementById("sendBtn");
  btn.disabled = true;
  btn.innerText = "Sending...";

  const total = recipients.value.split(/[\n,]+/).filter(e => e.trim()).length;

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

  btn.disabled = false;
  btn.innerText = "Send All";

  if (result.success) {
    showPopup(`Mail Sent ${result.sent}/${result.total}`);
  } else if (result.error === "auth") {
    showPopup("Not ☒ (Wrong App Password)");
  } else {
    showPopup(result.error);
  }
}

function showPopup(msg) {
  popupText.innerText = msg;
  popup.style.display = "flex";
}

function closePopup() {
  popup.style.display = "none";
}

function logout() {
  window.location = "login.html";
}
