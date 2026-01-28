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

  const res = await fetch("/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" }, // 🔥 REQUIRED
    body: JSON.stringify(data) // 🔥 REQUIRED
  });

  const result = await res.json();

  alert(result.msg);
  document.getElementById("counter").innerText = result.count + "/28";

  btn.disabled = false;
  btn.innerText = "Send All";
}
