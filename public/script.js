if (!sessionStorage.getItem("auth")) location.href = "/login.html";

let sending = false;

sendBtn.onclick = () => { if (!sending) sendMail(); };
logoutBtn.ondblclick = () => {
  sessionStorage.clear();
  location.href = "/login.html";
};

async function sendMail() {
  sending = true;
  sendBtn.disabled = true;
  sendBtn.innerText = "Sending…";

  try {
    const res = await fetch("/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderName: senderName.value.trim(),
        gmail: gmail.value.trim(),
        apppass: apppass.value.trim(),
        subject: subject.value.trim(),
        message: message.value.trim(),
        to: to.value.trim()
      })
    });

    const data = await res.json();

    if (!data.success) return alert(data.msg);
    alert(`Send_1 ✅\nEmails Sent: ${data.sent}`);

  } catch {
    alert("Server error ❌");
  }

  sending = false;
  sendBtn.disabled = false;
  sendBtn.innerText = "Send All";
}
