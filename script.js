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

emailjs.init({ publicKey: emailjsConfig.publicKey });

const $ = (id) => document.getElementById(id);
let currentUser = null;
let state = null;

const todayKey = () => new Date().toISOString().slice(0,10);
const pad3 = (n) => String(n).padStart(3,"0");
const validCode = (s) => /^\d{3}$/.test(s) && Number(s) >= 0 && Number(s) <= 499;
function userKey(user){ return "hackzone_v58_user_" + (user.email || user.uid || "guest").toLowerCase(); }
function defaultState(user){
  return { name:user.displayName||"שחקן", email:user.email||"", points:70, shields:0, attemptsLeft:10, lastDaily:"", lastAttemptDay:todayKey(), debt:0, inventory:{}, createdAt:Date.now(), updatedAt:Date.now() };
}
function loadState(user){
  const raw = localStorage.getItem(userKey(user));
  if(!raw) return defaultState(user);
  try{ return {...defaultState(user), ...JSON.parse(raw)}; }catch{ return defaultState(user); }
}
function saveState(){
  if(!currentUser || !state) return;
  state.updatedAt = Date.now();
  localStorage.setItem(userKey(currentUser), JSON.stringify(state));
}
function resetDailyIfNeeded(){
  if(!state) return;
  const t = todayKey();
  if(state.lastAttemptDay !== t){ state.lastAttemptDay = t; state.attemptsLeft = 10; }
}
function render(){
  $("points").textContent = state ? state.points : "0";
  $("shields").textContent = state ? state.shields : "0";
  $("attempts").textContent = state ? state.attemptsLeft : "0";
  $("debt").textContent = state ? state.debt : "0";
  const inv = $("inventoryBox");
  if(inv && state){
    const items = state.inventory || {};
    const rows = Object.entries(items).filter(([k,v])=>v>0).map(([k,v])=>`${k}: ${v}`);
    inv.textContent = rows.length ? rows.join(" · ") : "אין מוצרים עדיין";
  }
  if($("playerName")) $("playerName").textContent = state ? state.name : "שחקן";
  if($("playerEmail")) $("playerEmail").textContent = state ? state.email : "לא מחובר";
}
function setMsg(id,text,cls=""){ const el=$(id); el.textContent=text; el.className="msg "+cls; }
function aiAutoRepair(show=true){
  if(!state) return [];
  const fixed=[];
  resetDailyIfNeeded();
  for(const k of ["points","shields","attemptsLeft","debt"]){
    if(typeof state[k] !== "number" || Number.isNaN(state[k])){ state[k]=k==="attemptsLeft"?10:0; fixed.push("תוקן ערך שבור: "+k); }
    if(state[k] < 0){ state[k]=0; fixed.push("נוקה ערך שלילי: "+k); }
  }
  if(state.attemptsLeft > 10){ state.attemptsLeft=10; fixed.push("ניסיונות הוחזרו למקסימום תקין"); }
  if(!state.inventory || typeof state.inventory !== "object"){ state.inventory={}; fixed.push("תוקן תיק מוצרים שבור"); }
  if(!state.email && currentUser?.email){ state.email=currentUser.email; fixed.push("סונכרן מייל לחשבון"); }
  if(state.debt > 0 && state.points > 0){
    const pay=Math.min(state.points,state.debt);
    state.points-=pay; state.debt-=pay; fixed.push(`נגבו ${pay} מטבעות לחוב`);
  }
  saveState(); render();
  if(show){
    if(fixed.length) setMsg("aiMsg","AI תיקן אוטומטית:\n"+fixed.join("\n"),"good");
    else setMsg("aiMsg","AI בדק — אין תקלה אוטומטית.","good");
  }
  return fixed;
}
$("googleLoginBtn").onclick = async()=>{ try{ await signInWithPopup(auth, provider); }catch(err){ setMsg("gameMsg","שגיאת התחברות: "+err.message,"bad"); } };
$("logoutBtn").onclick = ()=>signOut(auth);
onAuthStateChanged(auth,(user)=>{
  currentUser=user;
  if(user){
    state=loadState(user);
    $("googleLoginBtn").classList.add("hidden");
    $("logoutBtn").classList.remove("hidden");
    $("userBox").innerHTML=`<b>${user.displayName||"שחקן"}</b><br>${user.email||""}`;
    const fixed=aiAutoRepair(false);
    render();
    if(fixed.length) setMsg("aiMsg","AI תיקן אוטומטית:\n"+fixed.join("\n"),"good");
  }else{
    state=null;
    $("googleLoginBtn").classList.remove("hidden");
    $("logoutBtn").classList.add("hidden");
    $("userBox").textContent="";
    render();
  }
});
function requireLogin(){
  if(!currentUser || !state){ setMsg("gameMsg","צריך להתחבר עם Google קודם.","warn"); return false; }
  return true;
}
$("dailyBtn").onclick=()=>{
  if(!requireLogin()) return;
  const t=todayKey();
  if(state.lastDaily===t){ setMsg("gameMsg","כבר לקחת בונוס יומי היום.","warn"); return; }
  state.lastDaily=t; state.points+=50; saveState(); render(); setMsg("gameMsg","קיבלת 50 מטבעות!","good");
};
$("scanBtn").onclick=()=>{
  if(!requireLogin()) return;
  resetDailyIfNeeded();
  const code=$("codeInput").value.trim();
  if(!validCode(code)){ setMsg("gameMsg","קוד לא תקין. כתוב מספר מ־000 עד 499.","warn"); return; }
  if(state.attemptsLeft<=0){ setMsg("gameMsg","נגמרו הניסיונות להיום.","warn"); return; }
  state.attemptsLeft-=1;
  const target=pad3((new Date().getDate()*17 + new Date().getMonth()*31) % 500);
  if(code===target){ const reward=120+Math.floor(Math.random()*80); state.points+=reward; setMsg("gameMsg",`בינגו! קיבלת ${reward} מטבעות.`,"good"); }
  else{ const small=5+Math.floor(Math.random()*12); state.points+=small; setMsg("gameMsg",`לא זה הקוד היום, אבל קיבלת ${small} מטבעות ניסיון.`,""); }
  aiAutoRepair(false); saveState(); render();
};
$("buyShieldBtn").onclick=()=>{
  if(!requireLogin()) return;
  if(state.points<50){ setMsg("gameMsg","אין מספיק מטבעות לקנות מגן.","warn"); return; }
  state.points-=50; state.shields+=1; saveState(); render(); setMsg("gameMsg","קנית מגן.","good");
};
$("loanBtn").onclick=()=>{
  if(!requireLogin()) return;
  state.points+=100; state.debt+=110; saveState(); render(); setMsg("gameMsg","לקחת הלוואה של 100. החוב הוא 110.","warn");
};
$("aiFixBtn").onclick=()=>{ if(requireLogin()) aiAutoRepair(true); };
$("sendProblemBtn").onclick=async()=>{
  if(!requireLogin()) return;
  const message=$("problemText").value.trim();
  if(!message){ setMsg("emailMsg","כתוב קודם מה הבעיה.","warn"); return; }
  setMsg("emailMsg","שולח...","");
  try{
    await emailjs.send(emailjsConfig.serviceId,emailjsConfig.templateId,{
      user_name: state.name || currentUser.displayName || "שחקן",
      user_email: state.email || currentUser.email || "",
      message,
      time: new Date().toLocaleString("he-IL")
    });
    $("problemText").value="";
    setMsg("emailMsg","נשלח למייל של עמית ✅","good");
  }catch(err){
    setMsg("emailMsg","שליחה נכשלה: "+(err?.text || err?.message || "שגיאה לא ידועה"),"bad");
  }
};


document.querySelectorAll(".topPills button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const el = document.getElementById(btn.dataset.jump);
    if(el) el.scrollIntoView({behavior:"smooth", block:"start"});
  });
});
if($("playerMenuBtn")){
  $("playerMenuBtn").onclick = ()=>{
    $("playerMenu").classList.toggle("hidden");
  };
}
function buyItem(key, label, price){
  if(!requireLogin()) return;
  if(state.points < price){
    setMsg("gameMsg",`אין מספיק מטבעות בשביל ${label}.`,"warn");
    return;
  }
  state.points -= price;
  state.inventory = state.inventory || {};
  state.inventory[label] = (state.inventory[label] || 0) + 1;
  if(key === "shield") state.shields += 1;
  if(key === "attempt") state.attemptsLeft += 1;
  saveState();
  render();
  setMsg("gameMsg",`קנית ${label}.`,"good");
}
if($("buyShieldBtn2")) $("buyShieldBtn2").onclick=()=>buyItem("shield","מגן",50);
if($("buyBoostBtn")) $("buyBoostBtn").onclick=()=>buyItem("boost","בוסט",80);
if($("buyInsuranceBtn")) $("buyInsuranceBtn").onclick=()=>buyItem("insurance","ביטוח",90);
if($("buyVaultBtn")) $("buyVaultBtn").onclick=()=>buyItem("vault","כספת",120);
if($("buyTrapBtn")) $("buyTrapBtn").onclick=()=>buyItem("trap","מלכודת",100);
if($("buyAttemptBtn")) $("buyAttemptBtn").onclick=()=>buyItem("attempt","ניסיון נוסף",30);
