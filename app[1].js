// Bank Management System - data is stored in localStorage
const KEY = "bms_accounts";
let accounts = JSON.parse(localStorage.getItem(KEY)) || [];
let selectedId = null;

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString("en-PK");
const save = () => localStorage.setItem(KEY, JSON.stringify(accounts));

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- Login & Theme ---------- */
function showApp() {
  const ok = sessionStorage.getItem("bms_login") === "1";
  $("login").classList.toggle("hidden", ok);
  $("app").classList.toggle("hidden", !ok);
  if (ok) render();
}
$("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if ($("user").value === "admin" && $("pass").value === "admin123") {
    sessionStorage.setItem("bms_login", "1");
    showApp();
  } else toast("Wrong username or password");
});
$("logoutBtn").onclick = () => { sessionStorage.removeItem("bms_login"); showApp(); };

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem("bms_theme", t);
  $("themeBtn").textContent = t === "dark" ? "☀️" : "🌙";
  if (accounts.length) drawChart();
}
$("themeBtn").onclick = () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");

/* ---------- Helpers ---------- */
const nextAccNo = () => "PK" + (1000 + accounts.length + 1) + Math.floor(Math.random() * 90 + 10);
const addTxn = (acc, type, amount, note) =>
  acc.history.unshift({ type, amount, note, date: new Date().toLocaleString() });

/* ---------- Render ---------- */
function render() {
  const q = $("search").value.toLowerCase();
  $("cards").innerHTML = accounts
    .filter((a) => a.name.toLowerCase().includes(q) || a.accNo.toLowerCase().includes(q))
    .map((a) => `<div class="atm" onclick="showHistory('${a.accNo}')">
        <button class="del" onclick="event.stopPropagation(); removeAccount('${a.accNo}')">Delete</button>
        <div class="chip"></div>
        <div class="no">${a.accNo}</div>
        <div class="bal">PKR ${fmt(a.balance)}</div>
        <div class="row"><span>${a.name}</span><span>${a.type}</span></div>
        <div class="row"><span>${a.cnic}</span></div>
      </div>`).join("") || "<p>No accounts found</p>";

  const opts = accounts.map((a) => `<option value="${a.accNo}">${a.accNo} - ${a.name}</option>`).join("");
  $("txnAcc").innerHTML = opts;
  $("toAcc").innerHTML = opts;

  $("statAccounts").textContent = accounts.length;
  $("statBalance").textContent = fmt(accounts.reduce((s, a) => s + a.balance, 0));
  $("statTxn").textContent = accounts.reduce((s, a) => s + a.history.length, 0);
  renderHistory();
  drawChart();
}

function renderHistory() {
  const acc = accounts.find((a) => a.accNo === selectedId);
  $("histFor").textContent = acc ? `(${acc.name})` : "";
  $("history").innerHTML = acc && acc.history.length
    ? acc.history.map((h) => `<li><span>${h.date}<br>${h.note}</span>
        <b class="${h.type === "credit" ? "credit" : "debit"}">${h.type === "credit" ? "+" : "-"}${fmt(h.amount)}</b></li>`).join("")
    : "<li>Click an account card to see its history</li>";
}

function drawChart() {
  const c = $("chart"), ctx = c.getContext("2d");
  c.width = c.clientWidth || 400; c.height = 220;
  ctx.clearRect(0, 0, c.width, c.height);
  const data = accounts.slice(0, 6);
  if (!data.length) return;
  const css = getComputedStyle(document.documentElement);
  const max = Math.max(...data.map((a) => a.balance), 1);
  const w = c.width / data.length;
  data.forEach((a, i) => {
    const h = (a.balance / max) * 150;
    const g = ctx.createLinearGradient(0, 190 - h, 0, 190);
    g.addColorStop(0, "#16a34a"); g.addColorStop(1, "#0b5d3b");
    ctx.fillStyle = g;
    ctx.fillRect(i * w + w * 0.2, 190 - h, w * 0.6, h);
    ctx.fillStyle = css.getPropertyValue("--text");
    ctx.font = "12px Arial"; ctx.textAlign = "center";
    ctx.fillText(fmt(a.balance), i * w + w / 2, 182 - h);
    ctx.fillText(a.name.split(" ")[0], i * w + w / 2, 210);
  });
}

window.showHistory = (accNo) => { selectedId = accNo; renderHistory(); };
window.removeAccount = (accNo) => {
  if (!confirm("Delete this account?")) return;
  accounts = accounts.filter((a) => a.accNo !== accNo);
  save(); render(); toast("Account deleted");
};

/* ---------- Forms ---------- */
$("createForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const cnic = $("cnic").value.trim();
  if (accounts.some((a) => a.cnic === cnic)) return toast("This CNIC already has an account");
  const initial = Number($("initial").value);
  const acc = { accNo: nextAccNo(), name: $("name").value.trim(), cnic, type: $("type").value, balance: initial, history: [] };
  if (initial > 0) addTxn(acc, "credit", initial, "Initial deposit");
  accounts.push(acc);
  save(); render(); e.target.reset(); toast("Account created: " + acc.accNo);
});

$("txnType").addEventListener("change", (e) =>
  $("toAcc").classList.toggle("hidden", e.target.value !== "transfer"));

$("txnForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const acc = accounts.find((a) => a.accNo === $("txnAcc").value);
  const amount = Number($("amount").value);
  const type = $("txnType").value;
  if (!acc) return toast("Create an account first");
  if (type === "deposit") {
    acc.balance += amount; addTxn(acc, "credit", amount, "Deposit");
  } else {
    if (amount > acc.balance) return toast("Insufficient balance");
    if (type === "withdraw") {
      acc.balance -= amount; addTxn(acc, "debit", amount, "Withdraw");
    } else {
      const to = accounts.find((a) => a.accNo === $("toAcc").value);
      if (!to || to.accNo === acc.accNo) return toast("Choose a different receiver");
      acc.balance -= amount; to.balance += amount;
      addTxn(acc, "debit", amount, "Transfer to " + to.accNo);
      addTxn(to, "credit", amount, "Transfer from " + acc.accNo);
    }
  }
  selectedId = acc.accNo;
  save(); render(); e.target.reset(); toast("Transaction successful");
});

$("search").addEventListener("input", render);
window.addEventListener("resize", () => accounts.length && drawChart());
setTheme(localStorage.getItem("bms_theme") || "light");
showApp();
