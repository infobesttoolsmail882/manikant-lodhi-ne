async function sendEmails() {
  const btn = document.getElementById("sendBtn");
  btn.disabled = true;
  btn.innerText = "Sending...";

  const listCount = recipients.value.split(/[\n,]+/).filter(e => e.trim()).length;
  status.innerText = `0/${listCount}`;

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
    status.innerText = `${result.sent}/${result.total}`;
    alert(`Mail Sent ${result.sent}/${result.total}`);
  } else if (result.error === "auth") {
    alert("Not ☒ (Wrong App Password)");
  } else {
    alert(result.error);
  }
}

function logout() {
  window.location = "login.html";
}
