async function sendEmails() {
  const data = {
    senderName: senderName.value,
    gmail: gmail.value,
    appPassword: appPassword.value,
    subject: subject.value,
    message: message.value,
    recipients: recipients.value
  };

  status.innerText = "Sending... please wait (rate limited for safety)";

  const res = await fetch("/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  const result = await res.json();
  status.innerText = result.success
    ? `Done! Sent: ${result.sent}`
    : `Error: ${result.error}`;
}

function logout() {
  window.location = "login.html";
}
