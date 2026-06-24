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
  "templateId": "template_hackzone",
  "to": "amithofmans@gmail.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

if(window.emailjs) emailjs.init({ publicKey: emailjsConfig.publicKey });

const $ = (id) => document.getElementById(id);
const qsa = (sel) => [...document.querySelectorAll(sel)];

let currentUser = null;
let me = null;
let selectedTarget = null;

const TODAY = () => new Date().toISOString().slice(0,10);
const safeNum = (n, d=0) => Number.isFinite(Number(n)) ? Number(n) : d;
const toast = (msg) => {
  const t = $("toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(()=>t.classList.remove("show"), 2600);
};

const demoPlayers = [
  {id:"bot1", name:"NeonFox", points:220, pin:"137", avatar:"https://api.dicebear.com/7.x/bottts/svg?seed=NeonFox"},
  {id:"bot2", name:"CyberKid", points:310, pin:"248", avatar:"https://api.dicebear.com/7.x/bottts/svg?seed=CyberKid"},
  {id:"bot3", name:"PixelNinja", points:180, pin:"059", avatar:"https://api.dicebear.com/7.x/bottts/svg?seed=PixelNinja"}
];

function keyFor(user){
  return "hackzone_v59_original_" + (user.email || user.uid || "guest").toLowerCase();
}
function defaultMe(user){
  const pin = ($("googlePin")?.value || "").trim();
  const gameName = ($("gameName")?.value || "").trim();
  return {
    id: user.uid,
    googleEmail: user.email || "",
    name: gameName || user.displayName || "שחקן",
    pin: /^\d{3}$/.test(pin) ? pin : "123",
    points: 70,
    avatar: user.photoURL || "https://api.dicebear.com/7.x/bottts/svg?seed=hack",
    captured: [],
    inventory: {},
    shields: 0,
    duelShields: 0,
    rewardBoosts: 0,
    insurances: 0,
    vaults: 0,
    traps: 0,
    attemptsLeft: 10,
    attemptsDay: TODAY(),
    loanDebt: 0,
    loanDueAt: 0,
    investments: [],
    events: [],
    createdAt: Date.now()
  };
}
function loadMe(user){
  try{
    const raw = localStorage.getItem(keyFor(user));
    if(raw) return {...defaultMe(user), ...JSON.parse(raw)};
  }catch{}
  return defaultMe(user);
}
function saveMe(){
  if(!currentUser || !me) return;
  me.updatedAt = Date.now();
  localStorage.setItem(keyFor(currentUser), JSON.stringify(me));
}
function normalize(){
  if(!me) return [];
  const fixed = [];
  const nums = ["points","shields","duelShields","rewardBoosts","insurances","vaults","traps","attemptsLeft","loanDebt"];
  for(const k of nums){
    if(!Number.isFinite(Number(me[k])) || Number(me[k]) < 0){
      me[k] = k === "attemptsLeft" ? 10 : 0;
      fixed.push("תוקן ערך שבור: " + k);
    } else me[k] = Number(me[k]);
  }
  if(me.attemptsDay !== TODAY()){
    me.attemptsDay = TODAY();
    me.attemptsLeft = 10;
    fixed.push("אופסו ניסיונות יומיים");
  }
  if(!me.inventory || typeof me.inventory !== "object"){ me.inventory = {}; fixed.push("תוקן תיק מוצרים"); }
  if(!Array.isArray(me.captured)){ me.captured = []; fixed.push("תוקנה רשימת פריצות"); }
  if(me.loanDebt > 0 && me.points > 0){
    const paid = Math.min(me.points, me.loanDebt);
    me.points -= paid; me.loanDebt -= paid;
    fixed.push(`נגבו ${paid} נקודות לחוב`);
  }
  saveMe();
  return fixed;
}
function addEvent(text){
  if(!me) return;
  me.events = me.events || [];
  me.events.unshift({text, time: new Date().toLocaleString("he-IL")});
  me.events = me.events.slice(0, 20);
  saveMe();
}
function setText(id, txt){
  const el = $(id);
  if(el) el.textContent = txt;
}
function setHTML(id, html){
  const el = $(id);
  if(el) el.innerHTML = html;
}
function showApp(){
  $("start")?.classList.add("hidden");
  $("app")?.classList.remove("hidden");
  $("logoutBtn")?.classList.remove("hidden");
}
function showStart(){
  $("start")?.classList.remove("hidden");
  $("app")?.classList.add("hidden");
  $("logoutBtn")?.classList.add("hidden");
}
function itemCount(key){ return safeNum(me.inventory?.[key], 0); }
function addItem(key, n=1){ me.inventory[key] = itemCount(key) + n; }
function useItem(key){
  if(itemCount(key) <= 0) return false;
  me.inventory[key]--;
  if(me.inventory[key] <= 0) delete me.inventory[key];
  return true;
}

function render(){
  if(!me) return;
  normalize();
  setText("miniName", me.name);
  setText("miniPoints", `${me.points} נק׳`);
  const miniAvatar = $("miniAvatar");
  if(miniAvatar) miniAvatar.src = me.avatar;
  const meAvatar = $("meAvatar");
  if(meAvatar) meAvatar.src = me.avatar;
  setText("meName", me.name);
  setHTML("meStats", `
    <div class="stat"><b>${me.points}</b><span>נקודות</span></div>
    <div class="stat"><b>${me.attemptsLeft}</b><span>ניסיונות היום</span></div>
    <div class="stat"><b>${me.shields}</b><span>מגנים</span></div>
    <div class="stat"><b>${me.loanDebt}</b><span>חוב</span></div>
  `);
  setText("shopPoints", `יש לך ${me.points} נקודות`);
  setText("attemptsStatus", `ניסיונות היום: ${me.attemptsLeft} / 10`);
  setText("shieldStatus", `מגנים: ${me.shields}`);
  setText("duelShieldStatus", `מגני דו־קרב: ${me.duelShields}`);
  setText("loanDebt", `${me.loanDebt} נק׳`);
  setText("loanCoins", `${me.points} נק׳ זמינות`);
  setText("loanTimeLeft", me.loanDebt ? "חוב פעיל במשחק" : "אין חוב");
  renderUsers();
  renderCaptured();
  renderInventory();
  renderEvents();
  renderScoreboard();
  renderInvestments();
}
function renderUsers(){
  const list = $("usersList");
  if(!list) return;
  list.innerHTML = demoPlayers.map(p=>`
    <div class="userCard" data-id="${p.id}">
      <img class="avatar" src="${p.avatar}">
      <div>
        <b>${p.name}</b>
        <span>${p.points} נק׳</span>
      </div>
      <button class="dots" data-menu="${p.id}">⋮</button>
    </div>
  `).join("");
  list.querySelectorAll(".userCard").forEach(card=>{
    card.onclick = (e)=>{
      if(e.target.classList.contains("dots")) return;
      selectedTarget = demoPlayers.find(p=>p.id===card.dataset.id);
      setHTML("targetBox", `<b>${selectedTarget.name}</b><br><span>${selectedTarget.points} נק׳</span>`);
      setText("terminal", `> target selected: ${selectedTarget.name}\n> waiting for 3-digit game code...`);
    };
  });
  list.querySelectorAll(".dots").forEach(btn=>{
    btn.onclick = ()=> {
      const p = demoPlayers.find(x=>x.id===btn.dataset.menu);
      selectedTarget = p;
      setHTML("targetBox", `<b>${p.name}</b><br><span>${p.points} נק׳</span>`);
      toast("נבחר דרך תפריט 3 נקודות: " + p.name);
    };
  });
}
function renderCaptured(){
  const el = $("capturedList");
  if(!el) return;
  if(!me.captured.length){ el.innerHTML = `<p class="muted">עדיין לא פרצת לאף שחקן במשחק.</p>`; return; }
  el.innerHTML = me.captured.map(c=>`<div class="capturedItem"><b>${c.name}</b><span>${c.time}</span></div>`).join("");
}
function renderInventory(){
  const out = $("shopOutput");
  if(!out) return;
  const items = Object.entries(me.inventory || {}).filter(([k,v])=>v>0);
  out.classList.remove("hidden");
  out.innerHTML = items.length ? `<b>התיק שלי:</b><br>` + items.map(([k,v])=>`${k} × ${v}`).join(" · ") : "התיק שלך ריק.";
}
function renderEvents(){
  const el = $("events");
  if(!el) return;
  el.innerHTML = (me.events||[]).map(e=>`<div class="event"><b>${e.time}</b><br>${e.text}</div>`).join("") || `<p class="muted">אין אירועים עדיין.</p>`;
}
function renderScoreboard(){
  const el = $("leaderboard");
  if(!el) return;
  const rows = [
    {name: me.name, points: me.points},
    ...demoPlayers.map(p=>({name:p.name, points:p.points}))
  ].sort((a,b)=>b.points-a.points);
  el.innerHTML = rows.map((r,i)=>`<div class="scoreRow"><b>#${i+1} ${r.name}</b><span>${r.points} נק׳</span></div>`).join("");
}
function renderInvestments(){
  const el = $("investmentsList");
  if(!el) return;
  if(!me.investments?.length){ el.innerHTML = `<p class="muted">אין השקעות עדיין.</p>`; return; }
  el.innerHTML = me.investments.map(i=>`<div class="investItem"><b>${i.type}</b><span>${i.amount} נק׳</span></div>`).join("");
  setText("investCash", `${me.points} נק׳ זמינות`);
  setText("investTotal", `${me.investments.reduce((s,i)=>s+i.amount,0)} נק׳`);
}

function buy(key, label, price, onBuy){
  if(!me) return;
  if(me.points < price){ toast("אין מספיק נקודות"); return; }
  me.points -= price;
  if(onBuy) onBuy(); else addItem(label, 1);
  addEvent(`נקנה מוצר: ${label}`);
  saveMe(); render(); toast(`קנית ${label}`);
}
function hook(id, fn){ const el=$(id); if(el) el.onclick=fn; }

function setupTabs(){
  qsa(".nav").forEach(btn=>{
    btn.onclick = ()=>{
      qsa(".nav").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      qsa(".tabPage").forEach(p=>p.classList.add("hidden"));
      const page = $("tab-" + btn.dataset.tab);
      if(page) page.classList.remove("hidden");
      render();
    };
  });
}

function setupActions(){
  hook("refreshBtn", ()=>{ render(); toast("רוענן"); });
  hook("guessBtn", ()=>{
    if(!selectedTarget){ setText("guessResult","בחר קודם שחקן מהרשימה."); return; }
    normalize();
    if(me.attemptsLeft <= 0){ setText("guessResult","נגמרו הניסיונות היום."); return; }
    const guess = ($("guessPin")?.value || "").trim();
    if(!/^\d{3}$/.test(guess)){ setText("guessResult","כתוב קוד 3 ספרות."); return; }
    me.attemptsLeft--;
    if(guess === selectedTarget.pin){
      const reward = Math.floor(selectedTarget.points * 0.7);
      me.points += reward;
      me.captured.unshift({name:selectedTarget.name, time:new Date().toLocaleString("he-IL")});
      setText("terminal", `> ACCESS GRANTED\n> reward: ${reward} points`);
      setText("guessResult", `הצלחת במשחק! קיבלת ${reward} נקודות.`);
      addEvent(`פרצת במשחק את ${selectedTarget.name} וקיבלת ${reward} נק׳`);
    }else{
      setText("terminal", `> ACCESS DENIED\n> attempts left: ${me.attemptsLeft}`);
      setText("guessResult","לא נכון. נסה שוב.");
    }
    saveMe(); render();
  });

  hook("buyScan10Btn", ()=>buy("scan10","סורק 10",5));
  hook("buyScan100Btn", ()=>buy("scan100","סורק 100",12));
  hook("buyHint1Btn", ()=>buy("hint1","רמז ספרה ראשונה",10));
  hook("buyHint2Btn", ()=>buy("hint2","רמז 2 ספרות",18));
  hook("luckyAttackBtn", ()=>buy("lucky","מתקפת מזל",8));
  hook("autoHackBtn", ()=>buy("auto","פיצוח אוטומטי",35));
  hook("duelTicketBtn", ()=>buy("duel","כרטיס דו־קרב",30));
  hook("duelShieldBtn", ()=>buy("duelShield","מגן דו־קרב",25,()=>me.duelShields++));
  hook("boostBtn", ()=>buy("boost","בוסט כפול",60,()=>me.rewardBoosts++));
  hook("insuranceBtn", ()=>buy("insurance","ביטוח פריצה",45,()=>me.insurances++));
  hook("vaultBtn", ()=>buy("vault","כספת 500",50,()=>me.vaults++));
  hook("extraAttemptBtn", ()=>buy("attempt","ניסיון יומי נוסף",40,()=>me.attemptsLeft++));
  hook("trapBtn", ()=>buy("trap","מלכודת פריצה",55,()=>me.traps++));
  hook("cooldownKeyBtn", ()=>buy("cooldown","מפתח קירור",35));

  hook("takeLoanBtn", ()=>{
    const amount = Math.max(10, safeNum($("loanAmount")?.value, 100));
    const days = Math.max(1, safeNum($("loanDays")?.value, 1));
    const interest = Math.ceil(amount * (0.10 + Math.max(0,days-1)*0.01));
    me.points += amount;
    me.loanDebt += amount + interest;
    setText("loanOutput", `קיבלת ${amount} נק׳. החוב: ${amount+interest}`);
    addEvent(`נלקחה הלוואה של ${amount} נק׳`);
    saveMe(); render();
  });
  hook("repayLoanBtn", ()=>{
    const amount = Math.min(safeNum($("repayLoanAmount")?.value, 0), me.points, me.loanDebt);
    if(amount <= 0){ setText("loanOutput","אין סכום להחזר."); return; }
    me.points -= amount; me.loanDebt -= amount;
    setText("loanOutput", `החזרת ${amount} נק׳`);
    saveMe(); render();
  });
  hook("repayAllLoanBtn", ()=>{
    const amount = Math.min(me.points, me.loanDebt);
    me.points -= amount; me.loanDebt -= amount;
    setText("loanOutput", `החזרת ${amount} נק׳`);
    saveMe(); render();
  });
  hook("aiDiagnoseBtn", ()=>aiFix(false));
  hook("aiFixSelfBtn", ()=>aiFix(true));
  hook("aiFixSystemBtn", ()=>aiFix(true));
  hook("aiChatFixBtn", ()=>aiChatFix());
  hook("sendFeedbackBtn", ()=>sendFeedback());

  hook("saveMeBtn", ()=>{
    const name = ($("myName")?.value || "").trim();
    const newPin = ($("newPin")?.value || "").trim();
    if(name) me.name = name;
    if(/^\d{3}$/.test(newPin)) me.pin = newPin;
    const avatarInput = $("myAvatarInput");
    if(avatarInput?.files?.[0]){
      const r = new FileReader();
      r.onload = () => { me.avatar = r.result; saveMe(); render(); toast("נשמר"); };
      r.readAsDataURL(avatarInput.files[0]);
    } else {
      saveMe(); render(); toast("נשמר");
    }
  });
}

function aiFix(apply){
  const fixed = normalize();
  const out = $("aiOutput");
  if(out){
    out.classList.remove("hidden");
    out.innerHTML = fixed.length ? "תוקן:<br>" + fixed.join("<br>") : "בדקתי — אין תקלה אוטומטית.";
  }
  if(apply) toast("AI תיקונים סיים בדיקה");
  render();
}
function aiChatFix(){
  const text = ($("aiChatText")?.value || "").trim();
  const out = $("aiOutput");
  if(!out) return;
  out.classList.remove("hidden");
  const fixed = normalize();
  let msg = "בדקתי את המשחק.";
  if(/חוב|הלווא/.test(text)) msg += " בדקתי חובות והחזר אוטומטי.";
  if(/מוצר|חנות|תיק/.test(text)) msg += " בדקתי תיק מוצרים.";
  if(/ניסיון|נסיון/.test(text)) msg += " בדקתי ניסיונות יומיים.";
  out.innerHTML = msg + "<br>" + (fixed.length ? fixed.join("<br>") : "אין תקלה אוטומטית.");
  render();
}
async function sendFeedback(){
  if(!me) return;
  const name = ($("feedbackName")?.value || me.name || "").trim();
  const subject = ($("feedbackSubject")?.value || "בעיה במשחק").trim();
  const note = ($("feedbackNote")?.value || "").trim();
  const out = $("feedbackOutput");
  if(!note){ if(out){out.classList.remove("hidden"); out.textContent="כתוב הערה קודם.";} return; }
  if(out){ out.classList.remove("hidden"); out.textContent="שולח..."; }
  try{
    await emailjs.send(emailjsConfig.serviceId, emailjsConfig.templateId, {
      user_name: name,
      user_email: me.googleEmail || "",
      message: subject + "\n\n" + note,
      time: new Date().toLocaleString("he-IL")
    });
    if(out) out.textContent = "נשלח לעמית ✅";
    addEvent("נשלחה הערה לעמית");
  }catch(err){
    if(out) out.textContent = "שליחה נכשלה: " + (err?.text || err?.message || "שגיאה");
  }
}

function initLogin(){
  const box = $("googleButton");
  if(box){
    box.innerHTML = `<button id="firebaseLoginBtn" class="primary full">התחבר עם Google</button>`;
    $("firebaseLoginBtn").onclick = async()=>{
      try{ await signInWithPopup(auth, provider); }
      catch(err){ setText("googleStatus", "שגיאת Google: " + err.message); }
    };
  }
  hook("logoutBtn", ()=>signOut(auth));
  onAuthStateChanged(auth, user=>{
    currentUser = user;
    if(user){
      me = loadMe(user);
      if($("gameName")?.value.trim()) me.name = $("gameName").value.trim();
      if(/^\d{3}$/.test(($("googlePin")?.value||"").trim())) me.pin = $("googlePin").value.trim();
      saveMe();
      showApp();
      const fixed = normalize();
      render();
      if(fixed.length) toast("AI תיקן אוטומטית בעיות משחק");
    }else{
      me = null;
      showStart();
    }
  });
}

setupTabs();
setupActions();
initLogin();
