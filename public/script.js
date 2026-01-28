function updateCounter() {
  const recipients = document.getElementById("to").value;
  const count = recipients.split(/,|\n/).filter(r => r.trim()).length;
  document.getElementById("limitText").innerText = `0/${count}`;
  return true;
}
