const sendBtn = document.getElementById("sendBtn");
const logoutBtn = document.getElementById("logoutBtn");

sendBtn.addEventListener("click", sendMail);
logoutBtn.addEventListener("click", async () => {
  await fetch("/logout", { method:"POST" });
  location.href = "/login.html";
});

async function sendMail() {
  sendBtn.disabled = true;
  sendBtn.innerText = "Sending…";

  const res = await fetch("/send", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      subject: subject.value,
      message: message.value,
      to: to.value
    })
  });

  const data = await res.json();
  sendBtn.disabled = false;
  sendBtn.innerText = "Send";

  if (!data.success) return alert(data.msg || "Failed ❌");
  alert("Mail sent (transactional use) ✅");
}
