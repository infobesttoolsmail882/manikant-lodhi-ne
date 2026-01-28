function updateCounter() {
  const recipients = document.getElementById("recipients").value;
  const count = recipients.split(/,|\n/).filter(r => r.trim()).length;
  document.getElementById("counter").innerText = `0/${count}`;
  return true;
}
