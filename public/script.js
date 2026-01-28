async function sendMail() {
  const btn = document.getElementById("sendBtn");
  btn.disabled = true;
  btn.innerText = "Sending...";

  const data = {
    sender: document.getElementById("sender").value,
    gmail: document.getElementById("gmail").value,
    appPassword: document.getElementById("apppass").value,
    subject: document.getElementById("subject").value,
    body: document.getElementById("body").value,
    recipients: document.getElementById("recipients").value
  };

  try {
    const res = await fetch("/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    alert(result.msg);
    document.getElementById("counter").innerText = result.count + "/28";
  } catch (err) {
    alert("Server error ❌");
  }

  btn.disabled = false;
  btn.innerText = "Send All";
}

async function logout() {
  await fetch("/logout", { method: "POST" });
  window.location.href = "/";
}
