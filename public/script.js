const sendBtn = document.getElementById('sendBtn');
const logoutBtn = document.getElementById('logoutBtn');

sendBtn.onclick = async () => {
  sendBtn.disabled = true;
  sendBtn.innerText = "Sending…";

  try {
    const res = await fetch('/send', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        senderName: senderName.value,
        email: email.value,
        password: password.value,
        subject: subject.value,
        message: message.value,
        recipients: recipients.value
      })
    });

    const data = await res.json();
    alert(data.message);
  } catch {
    alert("Server error");
  }

  sendBtn.disabled = false;
  sendBtn.innerText = "Send";
};

// Logout only on double click
logoutBtn.ondblclick = async () => {
  await fetch('/logout', { method: 'POST' });
  window.location.href = "/";
};
