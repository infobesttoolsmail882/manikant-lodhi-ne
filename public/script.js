async function sendMail() {
  const res = await fetch("/send", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({
      senderName: senderName.value,
      email: gmail.value,
      password: apppass.value,
      recipients: recipients.value,
      subject: subject.value,
      message: message.value
    })
  });

  const data = await res.json();
  alert(data.message || (data.success ? "Mail sent" : "Send failed"));
}

function logout() {
  fetch("/logout", { method: "POST" }).then(()=>location.href="/");
}
