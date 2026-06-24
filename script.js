import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const firebaseConfig = {
  "apiKey": "AIzaSyB1F31xvhwciwp6j3hk8rna31vGxj5nADs",
  "authDomain": "hack-zone-a5b53.firebaseapp.com",
  "projectId": "hack-zone-a5b53",
  "storageBucket": "hack-zone-a5b53.firebasestorage.app",
  "messagingSenderId": "683257928554",
  "appId": "1:683257928554:web:973b4bbe58bb7a0175e313",
  "measurementId": "G-CJK9CM4WBC"
};
const emailjsConfig = {
  "publicKey": "70sUiPaHoum6PLrET",
  "serviceId": "service_997fh9l",
  "templateId": "template_hackzone"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
if (window.emailjs) emailjs.init({ publicKey: emailjsConfig.publicKey });

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let currentUser = null;
let me = null;
let selectedTarget = null;

const TODAY = () => new Date().toISOString().slice(0,10);
const num = (v,d=0) => Number.isFinite(Number(v)) ? Number(v) : d;

const bots = [
  { id:"bot1", name:"NeonFox", pin:"137", points:220, avatar:"https://api.dicebear.com/7.x/bottts/svg?seed=NeonFox" },
  { id:"bot2", name:"CyberKid", pin:"248", points:310, avatar:"https://api.dicebear.com/7.x/bottts/svg?seed=CyberKid" },
  { id:"bot3", name:"PixelNinja", pin:"059", points:180, avatar:"https://api.dicebear.com/7.x/bottts/svg?seed=PixelNinja" },
  { id:"bot4", name:"CodeWolf", pin:"421", points:260, avatar:"https://api.dicebear.com/7.x/bottts/svg?seed=CodeWolf" }
];

function text(id, value) { const el=$(id); if(el) el.textContent = value; }
function html(id, value) { const el=$(id); if(el) el.innerHTML = value; }
function show(id) { const el=$(id); if(el) el.classList.remove("hidden"); }
function hide(id) { const el=$(id); if(el) el.classList.add("hidden"); }
function toast(msg) {
  const el = $("toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(()=>el.classList.remove("show"), 2500);
}
function userKey(user) {
  return "hackzone_v61_" + (user.email || user.uid || "guest").toLowerCase();
}
function makeDefault(user) {
  const inputName = ($("gameName")?.value || "").trim();
  const inputPin = ($("googlePin")?.value || "").trim();
  return {
    id: user.uid,
    googleEmail: user.email || "",
    name: inputName || user.displayName || "שחקן",
    pin: /^\d{3}$/.test(inputPin) ? inputPin : "123",
    avatar: user.photoURL || "https://api.dicebear.com/7.x/bottts/svg?seed=player",
    points: 100,
    attemptsLeft: 10,
    attemptsDay: TODAY(),
    shields: 0,
    duelShields: 0,
    rewardBoosts: 0,
    insurances: 0,
    vaults: 0,
    traps: 0,
    loanDebt: 0,
    captured: [],
    inventory: {},
    events: [],
    investments: []
  };
}
function loadMe(user) {
  try {
    const raw = localStorage.getItem(userKey(user));
    if (raw) return { ...makeDefault(user), ...JSON.parse(raw) };
  } catch {}
  return makeDefault(user);
}
function saveMe() {
  if (!currentUser || !me) return;
  localStorage.setItem(userKey(currentUser), JSON.stringify(me));
}
function normalize() {
  if (!me) return [];
  const fixes = [];
  for (const k of ["points","attemptsLeft","shields","duelShields","rewardBoosts","insurances","vaults","traps","loanDebt"]) {
    if (!Number.isFinite(Number(me[k])) || Number(me[k]) < 0) {
      me[k] = k === "attemptsLeft" ? 10 : 0;
      fixes.push("תוקן: " + k);
    } else me[k] = Number(me[k]);
  }
  if (me.attemptsDay !== TODAY()) {
    me.attemptsDay = TODAY();
    me.attemptsLeft = 10;
    fixes.push("אופסו ניסיונות יומיים");
  }
  if (!Array.isArray(me.captured)) { me.captured = []; fixes.push("תוקנה רשימת פריצות"); }
  if (!Array.isArray(me.events)) { me.events = []; fixes.push("תוקן יומן אירועים"); }
  if (!Array.isArray(me.investments)) { me.investments = []; fixes.push("תוקנו השקעות"); }
  if (!me.inventory || typeof me.inventory !== "object") { me.inventory = {}; fixes.push("תוקן תיק מוצרים"); }
  if (me.loanDebt > 0 && me.points > 0) {
    const paid = Math.min(me.loanDebt, me.points);
    me.loanDebt -= paid;
    me.points -= paid;
    fixes.push("נגבו נקודות לחוב: " + paid);
  }
  saveMe();
  return fixes;
}
function eventLog(msg) {
  if (!me) return;
  me.events.unshift({ time: new Date().toLocaleString("he-IL"), text: msg });
  me.events = me.events.slice(0, 30);
  saveMe();
}
function addItem(name, n=1) {
  me.inventory[name] = num(me.inventory[name]) + n;
}
function buy(label, price, fn) {
  if (!me) return;
  if (me.points < price) return toast("אין מספיק נקודות");
  me.points -= price;
  if (fn) fn(); else addItem(label);
  eventLog("נקנה מוצר: " + label);
  saveMe();
  render();
  toast("קנית " + label);
}

function render() {
  if (!me) return;
  normalize();

  text("miniName", me.name);
  text("miniPoints", me.points + " נק׳");
  const miniAvatar = $("miniAvatar"); if (miniAvatar) miniAvatar.src = me.avatar;
  const meAvatar = $("meAvatar"); if (meAvatar) meAvatar.src = me.avatar;

  text("meName", me.name);
  html("meStats", `
    <div class="stat"><b>${me.points}</b><span>נקודות</span></div>
    <div class="stat"><b>${me.attemptsLeft}</b><span>ניסיונות היום</span></div>
    <div class="stat"><b>${me.shields}</b><span>מגנים</span></div>
    <div class="stat"><b>${me.loanDebt}</b><span>חוב</span></div>
  `);

  text("shopPoints", "יש לך " + me.points + " נקודות");
  text("attemptsStatus", "ניסיונות היום: " + me.attemptsLeft + " / 10");
  text("shieldStatus", "מגנים: " + me.shields);
  text("duelShieldStatus", "מגני דו־קרב: " + me.duelShields);
  text("loanDebt", me.loanDebt + " נק׳");
  text("loanCoins", me.points + " נק׳ זמינות");
  text("loanTimeLeft", me.loanDebt ? "חוב פעיל במשחק" : "אין חוב");
  text("investCash", me.points + " נק׳ זמינות");
  text("investTotal", me.investments.reduce((s,i)=>s+i.amount,0) + " נק׳");

  renderUsers();
  renderCaptured();
  renderShopOutput();
  renderEvents();
  renderLeaderboard();
  renderInvestments();
}
function renderUsers() {
  const box = $("usersList");
  if (!box) return;
  box.innerHTML = bots.map(p => `
    <div class="userCard" data-id="${p.id}">
      <img class="avatar" src="${p.avatar}" />
      <div><b>${p.name}</b><span>${p.points} נק׳</span></div>
      <button class="dots" data-id="${p.id}">⋮</button>
    </div>
  `).join("");
  box.querySelectorAll(".userCard").forEach(card => {
    card.onclick = (e) => {
      if (e.target.classList.contains("dots")) return;
      selectedTarget = bots.find(b=>b.id===card.dataset.id);
      html("targetBox", `<b>${selectedTarget.name}</b><br><span>${selectedTarget.points} נק׳</span>`);
      text("terminal", "> target selected: " + selectedTarget.name + "\n> waiting for 3-digit game code...");
    };
  });
  box.querySelectorAll(".dots").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      selectedTarget = bots.find(b=>b.id===btn.dataset.id);
      html("targetBox", `<b>${selectedTarget.name}</b><br><span>${selectedTarget.points} נק׳</span>`);
      toast("נבחר דרך תפריט 3 נקודות");
    };
  });
}
function renderCaptured() {
  const el = $("capturedList");
  if (!el) return;
  if (!me.captured.length) {
    el.innerHTML = `<p class="muted">עדיין לא פרצת לאף שחקן במשחק.</p>`;
    return;
  }
  el.innerHTML = me.captured.map(c => `<div class="capturedItem"><b>${c.name}</b><span>${c.time}</span></div>`).join("");
}
function renderShopOutput() {
  const el = $("shopOutput");
  if (!el) return;
  show("shopOutput");
  const items = Object.entries(me.inventory).filter(([k,v])=>v>0);
  el.innerHTML = items.length ? "<b>התיק שלי:</b><br>" + items.map(([k,v])=>`${k} × ${v}`).join(" · ") : "התיק שלך ריק.";
}
function renderEvents() {
  const el = $("events");
  if (!el) return;
  el.innerHTML = me.events.length ? me.events.map(e=>`<div class="event"><b>${e.time}</b><br>${e.text}</div>`).join("") : `<p class="muted">אין אירועים עדיין.</p>`;
}
function renderLeaderboard() {
  const el = $("leaderboard");
  if (!el) return;
  const rows = [{ name: me.name, points: me.points }, ...bots.map(b=>({name:b.name, points:b.points}))].sort((a,b)=>b.points-a.points);
  el.innerHTML = rows.map((r,i)=>`<div class="scoreRow"><b>#${i+1} ${r.name}</b><span>${r.points} נק׳</span></div>`).join("");
}
function renderInvestments() {
  const el = $("investmentsList");
  if (!el) return;
  if (!me.investments.length) {
    el.innerHTML = `<p class="muted">אין השקעות עדיין.</p>`;
    return;
  }
  el.innerHTML = me.investments.map(i=>`<div class="investItem"><b>${i.type}</b><span>${i.amount} נק׳</span></div>`).join("");
}

function setupTabs() {
  $$(".nav").forEach(btn => {
    btn.onclick = () => {
      $$(".nav").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      $$(".tabPage").forEach(p=>p.classList.add("hidden"));
      show("tab-" + btn.dataset.tab);
      render();
    };
  });
}
function setupActions() {
  const hook = (id, fn) => { const el=$(id); if(el) el.onclick = fn; };

  hook("refreshBtn", () => { render(); toast("רוענן"); });
  hook("guessBtn", () => {
    if (!selectedTarget) return text("guessResult", "בחר קודם שחקן מהרשימה.");
    normalize();
    if (me.attemptsLeft <= 0) return text("guessResult", "נגמרו הניסיונות היום.");
    const guess = ($("guessPin")?.value || "").trim();
    if (!/^\d{3}$/.test(guess)) return text("guessResult", "כתוב קוד 3 ספרות.");
    me.attemptsLeft--;
    if (guess === selectedTarget.pin) {
      let reward = Math.floor(selectedTarget.points * 0.7);
      if (me.rewardBoosts > 0) { reward *= 2; me.rewardBoosts--; }
      me.points += reward;
      me.captured.unshift({ name: selectedTarget.name, time: new Date().toLocaleString("he-IL") });
      text("terminal", "> ACCESS GRANTED\n> reward: " + reward + " points");
      text("guessResult", "הצלחת במשחק! קיבלת " + reward + " נקודות.");
      eventLog("פרצת במשחק את " + selectedTarget.name + " וקיבלת " + reward + " נק׳");
    } else {
      if (me.insurances > 0) { me.insurances--; me.attemptsLeft++; }
      text("terminal", "> ACCESS DENIED\n> attempts left: " + me.attemptsLeft);
      text("guessResult", "לא נכון. נסה שוב.");
    }
    saveMe(); render();
  });

  hook("buyScan10Btn", ()=>buy("סורק 10",5));
  hook("buyScan100Btn", ()=>buy("סורק 100",12));
  hook("buyHint1Btn", ()=>buy("רמז ספרה ראשונה",10));
  hook("buyHint2Btn", ()=>buy("רמז 2 ספרות",18));
  hook("luckyAttackBtn", ()=>buy("מתקפת מזל",8));
  hook("autoHackBtn", ()=>buy("פיצוח אוטומטי",35));
  hook("duelTicketBtn", ()=>buy("כרטיס דו־קרב",30));
  hook("duelShieldBtn", ()=>buy("מגן דו־קרב",25,()=>me.duelShields++));
  hook("boostBtn", ()=>buy("בוסט כפול",60,()=>me.rewardBoosts++));
  hook("insuranceBtn", ()=>buy("ביטוח פריצה",45,()=>me.insurances++));
  hook("vaultBtn", ()=>buy("כספת 500",50,()=>me.vaults++));
  hook("extraAttemptBtn", ()=>buy("ניסיון יומי נוסף",40,()=>me.attemptsLeft++));
  hook("trapBtn", ()=>buy("מלכודת פריצה",55,()=>me.traps++));
  hook("cooldownKeyBtn", ()=>buy("מפתח קירור",35));

  hook("takeLoanBtn", () => {
    const amount = Math.max(10, num($("loanAmount")?.value, 100));
    const days = Math.max(1, num($("loanDays")?.value, 1));
    const interest = Math.ceil(amount * (0.10 + Math.max(0, days-1) * 0.01));
    me.points += amount;
    me.loanDebt += amount + interest;
    text("loanOutput", "קיבלת " + amount + " נק׳. החוב: " + (amount+interest));
    eventLog("נלקחה הלוואה של " + amount + " נק׳");
    saveMe(); render();
  });
  hook("repayLoanBtn", () => {
    const amount = Math.min(num($("repayLoanAmount")?.value, 0), me.points, me.loanDebt);
    if (amount <= 0) return text("loanOutput", "אין סכום להחזר.");
    me.points -= amount;
    me.loanDebt -= amount;
    text("loanOutput", "החזרת " + amount + " נק׳");
    saveMe(); render();
  });
  hook("repayAllLoanBtn", () => {
    const amount = Math.min(me.points, me.loanDebt);
    me.points -= amount;
    me.loanDebt -= amount;
    text("loanOutput", "החזרת " + amount + " נק׳");
    saveMe(); render();
  });
  hook("investBtn", () => {
    const type = $("investType")?.value || "בטוח";
    const amount = Math.max(1, num($("investAmount")?.value, 10));
    if (amount > me.points) return text("investOutput", "אין מספיק נקודות להשקעה.");
    me.points -= amount;
    me.investments.push({ type, amount, time: Date.now() });
    text("investOutput", "בוצעה השקעה: " + type + " · " + amount + " נק׳");
    eventLog("בוצעה השקעה: " + type);
    saveMe(); render();
  });

  hook("aiDiagnoseBtn", ()=>aiFix(false));
  hook("aiFixSelfBtn", ()=>aiFix(true));
  hook("aiFixSystemBtn", ()=>aiFix(true));
  hook("aiChatFixBtn", ()=>aiChatFix());
  hook("sendFeedbackBtn", ()=>sendFeedback());

  hook("saveMeBtn", () => {
    const name = ($("myName")?.value || "").trim();
    const newPin = ($("newPin")?.value || "").trim();
    if (name) me.name = name;
    if (/^\d{3}$/.test(newPin)) me.pin = newPin;
    const f = $("myAvatarInput")?.files?.[0];
    if (f) {
      const r = new FileReader();
      r.onload = () => { me.avatar = r.result; saveMe(); render(); toast("נשמר"); };
      r.readAsDataURL(f);
    } else {
      saveMe(); render(); toast("נשמר");
    }
  });
}
function aiFix(apply) {
  const fixes = normalize();
  show("aiOutput");
  html("aiOutput", fixes.length ? "תוקן:<br>" + fixes.join("<br>") : "בדקתי — אין תקלה אוטומטית.");
  if (apply) toast("AI סיים תיקון");
  render();
}
function aiChatFix() {
  const t = ($("aiChatText")?.value || "").trim();
  const fixes = normalize();
  show("aiOutput");
  let msg = "בדקתי לפי מה שכתבת.";
  if (/חוב|הלווא/.test(t)) msg += "<br>בדקתי חובות.";
  if (/מוצר|חנות|תיק/.test(t)) msg += "<br>בדקתי מוצרים.";
  if (/ניסיון|נסיון/.test(t)) msg += "<br>בדקתי ניסיונות.";
  html("aiOutput", msg + "<br>" + (fixes.length ? fixes.join("<br>") : "אין תקלה אוטומטית."));
  render();
}
async function sendFeedback() {
  const name = ($("feedbackName")?.value || me?.name || "").trim();
  const subject = ($("feedbackSubject")?.value || "בעיה במשחק").trim();
  const note = ($("feedbackNote")?.value || "").trim();
  show("feedbackOutput");
  if (!note) return text("feedbackOutput", "כתוב בעיה קודם.");
  text("feedbackOutput", "שולח...");
  try {
    await emailjs.send(emailjsConfig.serviceId, emailjsConfig.templateId, {
      user_name: name,
      user_email: me?.googleEmail || currentUser?.email || "",
      message: subject + "\n\n" + note,
      time: new Date().toLocaleString("he-IL")
    });
    text("feedbackOutput", "נשלח לעמית ✅");
  } catch (err) {
    text("feedbackOutput", "שליחה נכשלה: " + (err?.text || err?.message || "שגיאה"));
  }
}
function setupLogin() {
  const googleBox = $("googleButton");
  if (googleBox) {
    googleBox.innerHTML = `<button id="firebaseLoginBtn" class="primary full">התחבר עם Google</button>`;
    $("firebaseLoginBtn").onclick = async () => {
      try { await signInWithPopup(auth, provider); }
      catch (err) { text("googleStatus", "שגיאת Google: " + err.message); }
    };
  }
  const logout = $("logoutBtn");
  if (logout) logout.onclick = () => signOut(auth);

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      me = loadMe(user);
      const n = ($("gameName")?.value || "").trim();
      const p = ($("googlePin")?.value || "").trim();
      if (n) me.name = n;
      if (/^\d{3}$/.test(p)) me.pin = p;
      saveMe();
      hide("start");
      show("app");
      show("logoutBtn");
      const fixes = normalize();
      render();
      if (fixes.length) toast("AI תיקן אוטומטית");
    } else {
      me = null;
      show("start");
      hide("app");
      hide("logoutBtn");
    }
  });
}

setupTabs();
setupActions();
setupLogin();
