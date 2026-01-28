document.querySelector("form").addEventListener("submit", function () {
  const recipients = document.querySelector("textarea[name='recipients']").value;
  const count = recipients.split(/,|\n/).filter(r => r.trim()).length;
  document.getElementById("counter").innerText = `0/${count}`;
});
