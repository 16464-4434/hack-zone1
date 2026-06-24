import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getDatabase, ref, set, update, onValue, onDisconnect, push, remove } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

const firebaseConfig = {
  "apiKey": "AIzaSyB1F31xvhwciwp6j3hk8rna31vGxj5nADs",
  "authDomain": "hack-zone-a5b53.firebaseapp.com",
  "projectId": "hack-zone-a5b53",
  "storageBucket": "hack-zone-a5b53.firebasestorage.app",
  "messagingSenderId": "683257928554",
  "appId": "1:683257928554:web:973b4bbe58bb7a0175e313",
  "measurementId": "G-CJK9CM4WBC",
  "databaseURL": "https://hack-zone-a5b53-default-rtdb.firebaseio.com"
};
const emailjsConfig = {
  "publicKey": "70sUiPaHoum6PLrET",
  "serviceId": "service_997fh9l",
  "templateId": "template_hackzone"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getDatabase(app);

if (window.emailjs) emailjs.init({ publicKey: emailjsConfig.publicKey });

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let currentUser = null;
let me = null;
let selectedTarget = null;
let realPlayers = [];
let attacksSubscribed = false;
let playersSubscribed = false;

const TODAY = () => new Date().toISOString().slice(0, 10);
const now = () => Date.now();
const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const clamp = (v, min, max) => Math.max(min, Math.min(max, num(v, min)));

function text(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}
function html(id, value) {
  const el = $(id);
  if (el) el.innerHTML = value;
}
function show(id) {
  const el = $(id);
  if (el) el.classList.remove("hidden");
}
function hide(id) {
  const el = $(id);
  if (el) el.classList.add("hidden");
}
function toast(msg) {
  const el = $("toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("show"), 2600);
}

function userKey(user) {
  return "hackzone_v63_" + (user.email || user.uid || "guest").toLowerCase();
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
    hackedUntil: 0,
    banUntil: 0,
    lastAttackAt: {},
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
function saveLocal() {
  if (!currentUser || !me) return;
  localStorage.setItem(userKey(currentUser), JSON.stringify(me));
}
function saveMe() {
  saveLocal();
  publishMe();
}

function normalize() {
  if (!me) return [];
  const fixes = [];
  for (const k of ["points","attemptsLeft","shields","duelShields","rewardBoosts","insurances","vaults","traps","loanDebt","hackedUntil","banUntil"]) {
    if (!Number.isFinite(Number(me[k])) || Number(me[k]) < 0) {
      me[k] = k === "attemptsLeft" ? 10 : 0;
      fixes.push("תוקן: " + k);
    } else {
      me[k] = Number(me[k]);
    }
  }
  if (me.attemptsDay !== TODAY()) {
    me.attemptsDay = TODAY();
    me.attemptsLeft = 10;
    fixes.push("אופסו ניסיונות יומיים");
  }
  if (!me.lastAttackAt || typeof me.lastAttackAt !== "object") me.lastAttackAt = {};
  if (!Array.isArray(me.captured)) { me.captured = []; fixes.push("תוקנה רשימת הצלחות"); }
  if (!Array.isArray(me.events)) { me.events = []; fixes.push("תוקן יומן אירועים"); }
  if (!Array.isArray(me.investments)) { me.investments = []; fixes.push("תוקנו השקעות"); }
  if (!me.inventory || typeof me.inventory !== "object") { me.inventory = {}; fixes.push("תוקן תיק מוצרים"); }
  if (me.loanDebt > 0 && me.points > 0) {
    const paid = Math.min(me.loanDebt, me.points);
    me.loanDebt -= paid;
    me.points -= paid;
    fixes.push("נגבו נקודות לחוב: " + paid);
  }
  saveLocal();
  return fixes;
}

function safePublicName() {
  const n = (me?.name || currentUser?.displayName || "שחקן").trim();
  return n.slice(0, 32);
}
function publicPlayerData(online = true) {
  return {
    uid: currentUser.uid,
    name: safePublicName(),
    avatar: me?.avatar || currentUser.photoURL || "",
    points: num(me?.points, 0),
    online,
    gameCode: me?.pin || "123",
    hackedUntil: num(me?.hackedUntil, 0),
    updatedAt: now()
  };
}
function publishMe() {
  if (!currentUser || !me) return;
  const playerRef = ref(db, "players/" + currentUser.uid);
  update(playerRef, publicPlayerData(true)).catch(err => showPlayersDbError(err));
}
function setupPresence() {
  if (!currentUser || !me) return;
  const playerRef = ref(db, "players/" + currentUser.uid);
  set(playerRef, publicPlayerData(true)).catch(err => showPlayersDbError(err));
  onDisconnect(playerRef).update({
    online: false,
    updatedAt: now()
  });
}
function subscribePlayers() {
  if (playersSubscribed) return;
  playersSubscribed = true;
  const listRef = ref(db, "players");
  onValue(listRef, snap => {
    const data = snap.val() || {};
    realPlayers = Object.values(data)
      .filter(p => p && p.online === true)
      .sort((a,b) => num(b.points) - num(a.points));
    renderUsers();
    renderLeaderboard();
  }, err => showPlayersDbError(err));
}
function showPlayersDbError(err) {
  const message = err?.message || String(err || "");
  html("usersList", `
    <div class="empty">
      <b>Realtime Database עוד לא מחובר.</b><br>
      צריך ליצור Firebase Realtime Database ולשים Rules מתאימים.<br>
      שגיאה: ${message}
    </div>
  `);
}

async function sendAttack(targetUid, payload) {
  if (!currentUser || !me || !targetUid) return;
  const clean = {
    fromUid: currentUser.uid,
    fromName: safePublicName(),
    fromAvatar: me.avatar || "",
    createdAt: now(),
    ...payload
  };
  await push(ref(db, "attacks/" + targetUid), clean);
}
function subscribeMyAttacks() {
  if (!currentUser || attacksSubscribed) return;
  attacksSubscribed = true;
  const myInbox = ref(db, "attacks/" + currentUser.uid);
  onValue(myInbox, async snap => {
    const data = snap.val() || {};
    for (const [attackId, attack] of Object.entries(data)) {
      await processIncomingAttack(attackId, attack);
    }
  });
}
async function processIncomingAttack(attackId, attack) {
  if (!me || !attack || attack.fromUid === currentUser.uid) {
    await remove(ref(db, "attacks/" + currentUser.uid + "/" + attackId)).catch(()=>{});
    return;
  }

  const type = String(attack.type || "attack");
  let loss = clamp(attack.loss, 0, 1000);
  let msg = "";

  if (type === "gift") {
    const item = String(attack.item || "מתנה").slice(0, 30);
    const amount = clamp(attack.amount, 1, 999);
    if (item === "נקודות") me.points += amount;
    else addItem(item, amount);
    msg = `קיבלת מתנה מ־${attack.fromName}: ${item} × ${amount}`;
    eventLog(msg);
    showGift(msg);
    await remove(ref(db, "attacks/" + currentUser.uid + "/" + attackId)).catch(()=>{});
    saveMe();
    render();
    return;
  }

  if (type === "ban") {
    const minutes = clamp(attack.minutes, 1, 60);
    me.banUntil = now() + minutes * 60_000;
    msg = `נחסמת במשחק ל־${minutes} דקות.`;
    eventLog(msg);
    showBan(msg, minutes);
    await remove(ref(db, "attacks/" + currentUser.uid + "/" + attackId)).catch(()=>{});
    saveMe();
    render();
    return;
  }

  if (type === "forceCode") {
    showForceCode();
    msg = `התבקשת להחליף קוד משחק.`;
    eventLog(msg);
    await remove(ref(db, "attacks/" + currentUser.uid + "/" + attackId)).catch(()=>{});
    saveMe();
    render();
    return;
  }

  if (type === "counterTrap") {
    me.points = Math.max(0, me.points - loss);
    msg = `מלכודת נגדית פגעה בך: איבדת ${loss} נק׳.`;
    eventLog(msg);
    showHacked(msg);
    await remove(ref(db, "attacks/" + currentUser.uid + "/" + attackId)).catch(()=>{});
    saveMe();
    render();
    return;
  }

  // Regular incoming hack / lucky / auto / duel
  if (me.shields > 0) {
    me.shields--;
    msg = `המגן שלך חסם פריצה מ־${attack.fromName}.`;
    eventLog(msg);
    toast("מגן חסם פריצה");
  } else {
    if (me.vaults > 0 && loss > 0) {
      me.vaults--;
      loss = Math.max(0, loss - 500);
      eventLog("כספת הגנה על עד 500 נקודות.");
    }

    if (loss > 0) {
      me.points = Math.max(0, me.points - loss);
    }

    me.hackedUntil = now() + 60_000;
    msg = `נפרצת במשחק על ידי ${attack.fromName}. איבדת ${loss} נק׳.`;
    eventLog(msg);
    showHacked(msg);

    if (me.traps > 0) {
      me.traps--;
      await sendAttack(attack.fromUid, {
        type: "counterTrap",
        loss: 20,
        note: "מלכודת החזירה פגיעה"
      }).catch(()=>{});
      eventLog("מלכודת הופעלה ושלחה פגיעה נגדית.");
    }
  }

  await remove(ref(db, "attacks/" + currentUser.uid + "/" + attackId)).catch(()=>{});
  saveMe();
  render();
}

function showHacked(message) {
  html("hackedMessage", message || "נפרצת במשחק.");
  text("fakeTerminal", "> game breach event\\n> local protection active\\n> wait 60 seconds");
  show("hackedOverlay");
  let left = 60;
  text("hackedTimer", left + " שניות");
  clearInterval(showHacked.timer);
  showHacked.timer = setInterval(() => {
    left--;
    text("hackedTimer", Math.max(0,left) + " שניות");
    if (left <= 0) {
      clearInterval(showHacked.timer);
      hide("hackedOverlay");
    }
  }, 1000);
}
function showBan(message, minutes) {
  html("banMessage", message);
  text("banTimer", minutes + " דקות");
  show("banOverlay");
}
function showGift(message) {
  html("giftMessage", message);
  show("giftOverlay");
}
function showForceCode() {
  show("changeCodeOverlay");
}

function eventLog(msg) {
  if (!me) return;
  me.events.unshift({ time: new Date().toLocaleString("he-IL"), text: msg });
  me.events = me.events.slice(0, 30);
  saveLocal();
  publishMe();
}
function addItem(name, n=1) {
  me.inventory[name] = num(me.inventory[name]) + n;
}
function useItem(name) {
  if (num(me.inventory[name]) <= 0) return false;
  me.inventory[name]--;
  if (me.inventory[name] <= 0) delete me.inventory[name];
  saveMe();
  return true;
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

function selectedCode() {
  return String(selectedTarget?.gameCode || "000").padStart(3, "0").slice(0,3);
}
function targetReady() {
  if (!selectedTarget) {
    text("guessResult", "בחר קודם שחקן אמיתי מהרשימה.");
    return false;
  }
  if (selectedTarget.uid === currentUser?.uid) {
    text("guessResult", "אי אפשר לבחור את עצמך.");
    return false;
  }
  if (num(me.banUntil) > now()) {
    text("guessResult", "אתה חסום זמנית במשחק.");
    return false;
  }
  return true;
}
function cooldownMs(targetUid) {
  const last = num(me.lastAttackAt?.[targetUid], 0);
  return Math.max(0, 15*60_000 - (now() - last));
}
function canAttackTarget(targetUid) {
  const cd = cooldownMs(targetUid);
  if (cd <= 0) return true;
  if (useItem("מפתח קירור")) {
    me.lastAttackAt[targetUid] = 0;
    toast("מפתח קירור ביטל המתנה");
    return true;
  }
  const m = Math.ceil(cd / 60_000);
  text("guessResult", `צריך לחכות עוד ${m} דקות מול השחקן הזה, או להשתמש במפתח קירור.`);
  return false;
}
function markAttack(targetUid) {
  me.lastAttackAt[targetUid] = now();
  saveLocal();
}
function consumeAttemptOrInsurance() {
  normalize();
  if (me.attemptsLeft > 0) {
    me.attemptsLeft--;
    return true;
  }
  if (useItem("ניסיון יומי נוסף")) {
    me.attemptsLeft++;
    me.attemptsLeft--;
    return true;
  }
  text("guessResult", "נגמרו הניסיונות היום.");
  return false;
}
async function successAgainstTarget(kind, rewardPercent = 0.70, lossPercent = 0.70) {
  const targetPoints = num(selectedTarget.points, 0);
  let reward = Math.floor(targetPoints * rewardPercent);
  let loss = Math.floor(targetPoints * lossPercent);

  if (me.rewardBoosts > 0) {
    me.rewardBoosts--;
    reward *= 2;
  }

  me.points += reward;
  me.captured.unshift({
    uid: selectedTarget.uid,
    name: selectedTarget.name,
    time: new Date().toLocaleString("he-IL"),
    type: kind
  });
  me.captured = me.captured.slice(0, 30);
  markAttack(selectedTarget.uid);

  await sendAttack(selectedTarget.uid, {
    type: kind,
    loss,
    reward,
    note: kind
  }).catch(err => {
    text("guessResult", "הצלחת אצלך, אבל לא הצלחתי לשלוח אירוע לשחקן השני: " + err.message);
  });

  text("terminal", `> ${kind.toUpperCase()} SUCCESS\\n> reward: ${reward}\\n> target event sent`);
  text("guessResult", `הצלחה! קיבלת ${reward} נק׳. לשחקן השני יופיע אירוע "נפרצת".`);
  eventLog(`הצלחה מול ${selectedTarget.name}: ${kind} · +${reward} נק׳`);
  saveMe();
  render();
}
function failAgainstTarget(kind) {
  if (me.insurances > 0) {
    me.insurances--;
    me.attemptsLeft++;
    text("guessResult", "נכשל, אבל ביטוח החזיר ניסיון אחד.");
  } else {
    text("guessResult", "לא הצליח. נסה שוב.");
  }
  text("terminal", `> ${kind.toUpperCase()} FAILED\\n> attempts left: ${me.attemptsLeft}`);
  eventLog(`ניסיון נכשל מול ${selectedTarget?.name || "שחקן"}`);
  saveMe();
  render();
}

function render() {
  if (!me) return;
  normalize();

  const hackedLeft = Math.max(0, num(me.hackedUntil) - now());
  const banLeft = Math.max(0, num(me.banUntil) - now());
  text("blockedStatus", banLeft ? `חסום עוד ${Math.ceil(banLeft/60000)} דק׳` : (hackedLeft ? `נפרצת — נשאר ${Math.ceil(hackedLeft/1000)} שנ׳` : "פעיל"));
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

  const others = realPlayers.filter(p => p.uid !== currentUser?.uid);
  if (!others.length) {
    box.innerHTML = `
      <div class="empty">
        אין שחקנים אמיתיים מחוברים כרגע.<br>
        פתח את האתר במחשב/טלפון אחר והתחבר עם Google אחר — והוא יופיע כאן.
      </div>
    `;
    return;
  }

  box.innerHTML = others.map(p => {
    const hacked = num(p.hackedUntil) > now();
    return `
      <div class="userCard" data-id="${p.uid}">
        <img class="avatar" src="${p.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=" + encodeURIComponent(p.name)}" />
        <div>
          <b>${p.name}</b>
          <span class="${hacked ? "statusHacked" : "statusOnline"}">${num(p.points)} נק׳ · ${hacked ? "נפרץ כרגע" : "מחובר עכשיו"}</span>
        </div>
        <button class="dots" data-id="${p.uid}">⋮</button>
      </div>
    `;
  }).join("");

  box.querySelectorAll(".userCard").forEach(card => {
    card.onclick = (e) => {
      if (e.target.classList.contains("dots")) return;
      selectedTarget = others.find(p => p.uid === card.dataset.id);
      html("targetBox", `<b>${selectedTarget.name}</b><br><span>${num(selectedTarget.points)} נק׳ · שחקן אמיתי</span>`);
      text("terminal", "> real player selected: " + selectedTarget.name + "\\n> choose hack type or guess game code");
    };
  });

  box.querySelectorAll(".dots").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      selectedTarget = others.find(p => p.uid === btn.dataset.id);
      html("targetBox", `<b>${selectedTarget.name}</b><br><span>${num(selectedTarget.points)} נק׳ · שחקן אמיתי</span>`);
      toast("נבחר שחקן אמיתי");
    };
  });
}

function renderCaptured() {
  const el = $("capturedList");
  if (!el) return;
  if (!me.captured.length) {
    el.innerHTML = `<p class="muted">עדיין אין הצלחות במשחק.</p>`;
    return;
  }
  el.innerHTML = me.captured.map(c => `<div class="capturedItem"><b>${c.name}</b><span>${c.time} · ${c.type || "פריצה"}</span></div>`).join("");
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
  const rows = realPlayers.slice().sort((a,b)=>num(b.points)-num(a.points));
  if (!rows.length) {
    el.innerHTML = `<p class="muted">אין שחקנים מחוברים בלוח.</p>`;
    return;
  }
  el.innerHTML = rows.map((r,i)=>`<div class="scoreRow"><b>#${i+1} ${r.name}</b><span>${num(r.points)} נק׳</span></div>`).join("");
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

  hook("refreshBtn", () => { publishMe(); render(); toast("רוענן"); });

  hook("guessBtn", async () => {
    if (!targetReady()) return;
    if (!canAttackTarget(selectedTarget.uid)) return;
    if (!consumeAttemptOrInsurance()) return;

    const guess = ($("guessPin")?.value || "").trim();
    if (!/^\d{3}$/.test(guess)) return text("guessResult", "כתוב קוד 3 ספרות.");
    if (guess === selectedCode()) {
      await successAgainstTarget("פריצה רגילה", 0.70, 0.70);
    } else {
      failAgainstTarget("regular");
    }
  });

  hook("useScan10Btn", () => {
    if (!targetReady()) return;
    if (!useItem("סורק 10")) return text("guessResult", "אין לך סורק 10. קנה בחנות.");
    const code = selectedCode();
    const start = Math.max(0, num(code) - 5);
    const list = Array.from({length: 10}, (_,i)=>String(start+i).padStart(3,"0")).join(" · ");
    text("terminal", "> SCAN 10\\n> אפשרויות: " + list);
    text("guessResult", "סורק 10 הופעל.");
    eventLog("הופעל סורק 10 מול " + selectedTarget.name);
    render();
  });

  hook("useScan100Btn", () => {
    if (!targetReady()) return;
    if (!useItem("סורק 100")) return text("guessResult", "אין לך סורק 100. קנה בחנות.");
    const first = selectedCode()[0];
    text("terminal", `> SCAN 100\\n> הקוד נמצא בטווח: ${first}00-${first}99`);
    text("guessResult", "סורק 100 הופעל.");
    eventLog("הופעל סורק 100 מול " + selectedTarget.name);
    render();
  });

  hook("useHint1Btn", () => {
    if (!targetReady()) return;
    if (!useItem("רמז ספרה ראשונה")) return text("guessResult", "אין לך רמז ספרה ראשונה. קנה בחנות.");
    text("terminal", "> HINT 1\\n> הספרה הראשונה: " + selectedCode()[0]);
    text("guessResult", "קיבלת רמז ראשון.");
    eventLog("הופעל רמז ספרה ראשונה מול " + selectedTarget.name);
    render();
  });

  hook("useHint2Btn", () => {
    if (!targetReady()) return;
    if (!useItem("רמז 2 ספרות")) return text("guessResult", "אין לך רמז 2 ספרות. קנה בחנות.");
    text("terminal", "> HINT 2\\n> שתי הספרות הראשונות: " + selectedCode().slice(0,2));
    text("guessResult", "קיבלת רמז 2 ספרות.");
    eventLog("הופעל רמז 2 ספרות מול " + selectedTarget.name);
    render();
  });

  hook("useLuckyBtn", async () => {
    if (!targetReady()) return;
    if (!canAttackTarget(selectedTarget.uid)) return;
    if (!consumeAttemptOrInsurance()) return;
    if (!useItem("מתקפת מזל")) return text("guessResult", "אין לך מתקפת מזל. קנה בחנות.");
    const ok = Math.random() < 0.45;
    if (ok) await successAgainstTarget("מתקפת מזל", 0.35, 0.35);
    else failAgainstTarget("lucky");
  });

  hook("useAutoBtn", async () => {
    if (!targetReady()) return;
    if (!canAttackTarget(selectedTarget.uid)) return;
    if (!consumeAttemptOrInsurance()) return;
    if (!useItem("פיצוח אוטומטי")) return text("guessResult", "אין לך פיצוח אוטומטי. קנה בחנות.");
    await successAgainstTarget("פיצוח אוטומטי", 0.50, 0.50);
  });

  hook("useDuelBtn", async () => {
    if (!targetReady()) return;
    if (!canAttackTarget(selectedTarget.uid)) return;
    if (!useItem("כרטיס דו־קרב")) return text("guessResult", "אין לך כרטיס דו־קרב. קנה בחנות.");

    const myPower = me.points + Math.floor(Math.random()*100);
    const otherPower = num(selectedTarget.points) + Math.floor(Math.random()*100);
    if (myPower >= otherPower || me.duelShields > 0) {
      if (me.duelShields > 0 && myPower < otherPower) me.duelShields--;
      await successAgainstTarget("דו־קרב", 0.25, 0.25);
    } else {
      const loss = Math.min(35, me.points);
      me.points -= loss;
      await sendAttack(selectedTarget.uid, { type:"duel", loss:0, reward:0, note:"ניצח אותך בדו־קרב" }).catch(()=>{});
      text("guessResult", "הפסדת בדו־קרב ואיבדת " + loss + " נק׳.");
      eventLog("הפסדת בדו־קרב מול " + selectedTarget.name);
      saveMe();
      render();
    }
  });

  hook("useCooldownBtn", () => {
    if (!targetReady()) return;
    if (!useItem("מפתח קירור")) return text("guessResult", "אין לך מפתח קירור. קנה בחנות.");
    me.lastAttackAt[selectedTarget.uid] = 0;
    text("guessResult", "מפתח קירור הופעל. אפשר לנסות שוב על השחקן הזה.");
    eventLog("הופעל מפתח קירור מול " + selectedTarget.name);
    saveMe();
    render();
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
  hook("buyShieldBtn", ()=>buy("מגן פריצה",15,()=>me.shields++));

  hook("takeLoanBtn", () => {
    const amount = Math.max(10, num($("loanAmount")?.value, 100));
    const days = Math.max(1, num($("loanDays")?.value, 1));
    const interest = Math.ceil(amount * (0.10 + Math.max(0, days-1) * 0.01));
    me.points += amount;
    me.loanDebt += amount + interest;
    text("loanOutput", "קיבלת " + amount + " נק׳. החוב: " + (amount+interest));
    eventLog("נלקחה הלוואה של " + amount + " נק׳");
    saveMe();
    render();
  });

  hook("repayLoanBtn", () => {
    const amount = Math.min(num($("repayLoanAmount")?.value, 0), me.points, me.loanDebt);
    if (amount <= 0) return text("loanOutput", "אין סכום להחזר.");
    me.points -= amount;
    me.loanDebt -= amount;
    text("loanOutput", "החזרת " + amount + " נק׳");
    saveMe();
    render();
  });

  hook("repayAllLoanBtn", () => {
    const amount = Math.min(me.points, me.loanDebt);
    me.points -= amount;
    me.loanDebt -= amount;
    text("loanOutput", "החזרת " + amount + " נק׳");
    saveMe();
    render();
  });

  hook("investBtn", () => {
    const type = $("investType")?.value || "בטוח";
    const amount = Math.max(1, num($("investAmount")?.value, 10));
    if (amount > me.points) return text("investOutput", "אין מספיק נקודות להשקעה.");
    me.points -= amount;
    me.investments.push({ type, amount, time: now() });
    text("investOutput", "בוצעה השקעה: " + type + " · " + amount + " נק׳");
    eventLog("בוצעה השקעה: " + type);
    saveMe();
    render();
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
      r.onload = () => {
        me.avatar = r.result;
        saveMe();
        render();
        toast("נשמר");
      };
      r.readAsDataURL(f);
    } else {
      saveMe();
      render();
      toast("נשמר");
    }
  });

  hook("changePinBtn", () => {
    const oldPin = ($("oldPin")?.value || "").trim();
    const newPin = ($("newPin")?.value || "").trim();
    if (oldPin !== me.pin) return toast("הקוד הישן לא נכון");
    if (!/^\d{3}$/.test(newPin)) return toast("קוד חדש חייב 3 ספרות");
    me.pin = newPin;
    saveMe();
    toast("הקוד הוחלף");
  });

  hook("forceChangePinBtn", () => {
    const newPin = ($("forcedNewPin")?.value || "").trim();
    if (!/^\d{3}$/.test(newPin)) return toast("קוד חייב 3 ספרות");
    me.pin = newPin;
    hide("changeCodeOverlay");
    eventLog("הוחלף קוד אחרי בקשה במשחק");
    saveMe();
    render();
  });
  hook("closeHacked", () => hide("hackedOverlay"));
  hook("closeGiftBtn", () => hide("giftOverlay"));
  hook("exitCapturedBtn", () => hide("entered"));
  hook("saveCapturedBtn", () => toast("בגרסה בטוחה אי אפשר לשנות פרופיל של שחקן אחר בלי שרת מנהל."));
}

function aiFix(apply) {
  const fixes = normalize();
  show("aiOutput");
  html("aiOutput", fixes.length ? "תוקן:<br>" + fixes.join("<br>") : "בדקתי — אין תקלה אוטומטית.");
  if (apply) toast("AI סיים תיקון");
  saveMe();
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
  if (/פריצ|שחקנ/.test(t)) msg += "<br>בדקתי אירועי פריצה ושחקנים מחוברים.";
  html("aiOutput", msg + "<br>" + (fixes.length ? fixes.join("<br>") : "אין תקלה אוטומטית."));
  saveMe();
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
      message: subject + "\\n\\n" + note,
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
      try {
        await signInWithPopup(auth, provider);
      } catch (err) {
        text("googleStatus", "שגיאת Google: " + err.message);
      }
    };
  }

  const logout = $("logoutBtn");
  if (logout) {
    logout.onclick = async () => {
      if (currentUser) {
        await update(ref(db, "players/" + currentUser.uid), {
          online: false,
          updatedAt: now()
        }).catch(()=>{});
      }
      await signOut(auth);
    };
  }

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      me = loadMe(user);
      const n = ($("gameName")?.value || "").trim();
      const p = ($("googlePin")?.value || "").trim();
      if (n) me.name = n;
      if (/^\d{3}$/.test(p)) me.pin = p;
      saveLocal();

      hide("start");
      show("app");
      show("logoutBtn");

      setupPresence();
      subscribePlayers();
      subscribeMyAttacks();

      const fixes = normalize();
      saveMe();
      render();
      if (fixes.length) toast("AI תיקן אוטומטית");
    } else {
      me = null;
      realPlayers = [];
      playersSubscribed = false;
      attacksSubscribed = false;
      show("start");
      hide("app");
      hide("logoutBtn");
    }
  });
}

setupTabs();
setupActions();
setupLogin();
