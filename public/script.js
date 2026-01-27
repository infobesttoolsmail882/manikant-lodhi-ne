const rbox = document.getElementById("recipients");
const rcount = document.getElementById("rcount");

rbox.addEventListener("input", () => {
  const list = rbox.value.split(/[\n,]+/).filter(e => e.includes("@"));
  rcount.innerText = "Recipients: " + list.length;
});

async function sendMail() {
  const btn = document.getElementById("sendBtn");
  btn.disabled = true;
  btn.innerText = "Sending...";

  const payload = {
    senderName: senderName.value.trim(),
    email: gmail.value.trim(),
    password: apppass.value.trim(),
    recipients: recipients.value.trim(),
    subject: subject.value.trim(),
    message: message.value.trim()
  };

  try {
    const res = await fetch("/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    alert(data.message);

  } catch {
    alert("Network error");
  }

  btn.disabled = false;
  btn.innerText = "Send";
}

function logout() {
  fetch("/logout", { method: "POST" }).then(() => location.href="/");
}
