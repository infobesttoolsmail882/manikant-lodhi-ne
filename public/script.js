const sendBtn = document.getElementById("sendBtn");
const logoutBtn = document.getElementById("logoutBtn");

logoutBtn.addEventListener("dblclick", async () => {
  await fetch("/logout", { method: "POST" });
  location.href = "/login.html";
});

sendBtn.addEventListener("click", sendMail);

function showPopup(msg) {
  document.getElementById("popupText").innerText = msg;
  document.getElementById("popup").classList.remove("hidden");
}

function closePopup() {
  document.getElementById("popup").classList.add("hidden");
}

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

  if (!data.success) return showPopup(data.msg || "Failed ❌");
  showPopup(data.msg);
}
