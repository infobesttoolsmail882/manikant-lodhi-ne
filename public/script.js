const sendBtn = document.getElementById("sendBtn");
const logoutBtn = document.getElementById("logoutBtn");

logoutBtn.addEventListener("dblclick", async () => {
  await fetch("/logout", { method: "POST" });
  location.href = "/login.html";
});

sendBtn.addEventListener("click", async () => {
  sendBtn.disabled = true;
  sendBtn.innerText = "Sending…";

  const res = await fetch("/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      senderName: senderName.value,
      gmail: gmail.value,
      apppass: apppass.value,
      subject: subject.value,
      message: message.value,
      to: to.value
    })
  });

  const data = await res.json();

  sendBtn.disabled = false;
  sendBtn.innerText = "Send";

  showPopup(data.msg || "Done");
});

function showPopup(msg) {
  popupText.innerText = msg;
  popup.classList.remove("hidden");
}

function closePopup() {
  popup.classList.add("hidden");
}
