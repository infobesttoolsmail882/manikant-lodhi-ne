document.getElementById("sendBtn").onclick = async () => {
  const res = await fetch("/send", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      email: email.value,
      password: password.value,
      to: to.value,
      subject: subject.value,
      message: message.value
    })
  });

  const data = await res.json();
  alert(data.message);
};

function logout(){
  fetch("/logout",{method:"POST"}).then(()=>location.href="/login");
}
