/* FindIt – CSE-E Lost & Found (frontend demo; data is stored in this browser via localStorage) */
var PASS = "csee@4321";
var KEY = "findit_v3";
var me = null, sec = "upload", q = "", photo = "";
var db = load();
var firebaseReady = false, dbRef = null, pendingLocalData = db;

function load() { try { var s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {} return { items: [], notes: [] }; }
function normalizeData(data) {
  data = data || { items: [], notes: [] };
  function asArray(value) { return Array.isArray(value) ? value : (value ? Object.keys(value).sort(function(a,b){return Number(a)-Number(b);}).map(function(k){return value[k];}) : []); }
  data.items = asArray(data.items).filter(Boolean);
  data.notes = asArray(data.notes).filter(Boolean);
  data.items.forEach(function(i){ if (!Array.isArray(i.claims)) i.claims = []; });
  return data;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast("Local backup full"); }
  if (firebaseReady && dbRef) {
    dbRef.set(db).catch(function(error){ toast("Cloud save failed: " + error.message); });
  }
}
function isAdmin() { return !!me && me.id === "358"; }

/* Firebase sign-in + real-time cloud sync. Existing local data is copied only if cloud is empty. */
function startFirebase() {
  try {
    var firebaseConfig = {
      apiKey: "AIzaSyDlm2kWeVLJR-LmcomapI5NO8M7eUql--c",
      authDomain: "findit-csee.firebaseapp.com",
      databaseURL: "https://findit-csee-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "findit-csee",
      storageBucket: "findit-csee.firebasestorage.app",
      messagingSenderId: "148454573901",
      appId: "1:148454573901:web:487da86051d4d31f4a5904"
    };
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    firebase.auth().signInAnonymously().then(function(){
      dbRef = firebase.database().ref("findit");
      dbRef.on("value", function(snapshot){
        var cloudData = snapshot.val();
        if (cloudData) {
          db = normalizeData(cloudData);
          firebaseReady = true;
          try { localStorage.setItem(KEY, JSON.stringify(db)); } catch(e) {}
          render();
        } else {
          firebaseReady = true;
          var oldData = normalizeData(pendingLocalData);
          if (oldData.items.length || oldData.notes.length) {
            db = oldData;
            dbRef.set(db).catch(function(error){ toast("Cloud migration failed: " + error.message); });
          } else {
            db = {items:[], notes:[]};
            dbRef.set(db).catch(function(error){ toast("Cloud setup failed: " + error.message); });
          }
          render();
        }
      }, function(error){ toast("Database error: " + error.message); });
    }).catch(function(error){ toast("Firebase login failed: " + error.message); });
  } catch (error) {
    toast("Firebase could not start. Check Firebase scripts and config.");
    console.error(error);
  }
}

function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function norm(s) { return String(s).trim().replace(/\s+/g, " ").toLowerCase(); }
function ago(t) { var m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; }
var tt; function toast(m) {
  var d = document.getElementById("toast");
  if (!d) { d = document.createElement("div"); d.id = "toast"; d.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);bottom:calc(20px + env(safe-area-inset-bottom,0px));background:#1b2333;color:#fff;padding:10px 18px;border-radius:10px;z-index:9"; document.body.appendChild(d); }
  d.textContent = m; d.style.display = "block"; clearTimeout(tt); tt = setTimeout(function () { d.style.display = "none"; }, 2800);
}

/* ---------- big notification board (visible before and after login) ---------- */
function renderBoard() {
  var l = db.items.slice(0, 6);
  document.getElementById("board").innerHTML = "<h2>🔔 Live Notifications</h2>" + (l.length ? l.map(function (i) {
    return '<div class="feed-i">' + (i.img ? '<img src="' + i.img + '" alt="">' : '<div class="th">📦</div>') +
      "<div><b>" + esc(i.title) + "</b> found by <b>" + esc(i.byName) + "</b><br><small>" + ago(i.t) + (i.status === "returned" ? " · Returned" : "") + "</small></div></div>";
  }).join("") : '<div class="empty">No item uploaded yet.</div>');
}

/* ---------- login (details below the board) ---------- */
function loginView() {
  return '<section class="card login"><h3>Enter your details</h3><div class="sub">Only CSE-E students can enter.</div>' +
    '<label>Registration No. (last 3 digits)</label><input id="uid" inputmode="numeric" maxlength="3" placeholder="e.g. 321">' +
    '<label>Name</label><input id="nm" placeholder="Your name (any case)">' +
    '<label>Common password</label><input id="pw" type="password" onkeydown="if(event.key===\'Enter\')login()">' +
    '<div class="err" id="err"></div><button class="btn" style="width:100%" onclick="login()">Login</button></section>';
}
function login() {
  var id = document.getElementById("uid").value.trim(), nm = document.getElementById("nm").value, pw = document.getElementById("pw").value, e = document.getElementById("err");
  var u = ROSTER.filter(function (r) { return r.id === id && norm(r.name) === norm(nm); })[0];
  if (!u) { e.textContent = "ID and name do not match. Only CSE-E students can enter."; return; }
  if (pw !== PASS) { e.textContent = "Wrong common password."; return; }
  me = u; sec = "upload"; render();
}
function logout() { me = null; render(); }

/* ---------- main screen after login ---------- */
function myNotes() { return db.notes.filter(function (n) { return n.to === me.id; }).sort(function (a, b) { return b.t - a.t; }); }
function appView() {
  var t = db.items.length, r = db.items.filter(function (i) { return i.status === "returned"; }).length, mn = myNotes().slice(0, 4);
  return '<div class="bar"><div>Welcome, <b>' + esc(me.name) + '</b><div class="sub">' + esc(me.id) + '</div></div><button class="btn s gh" onclick="logout()">Logout</button></div>' +
    '<div class="grid g3"><div class="card stat"><b>' + t + '</b><span>Items uploaded</span></div><div class="card stat"><b style="color:var(--warn)">' + (t - r) + '</b><span>Pending</span></div><div class="card stat"><b style="color:var(--ok)">' + r + '</b><span>Returned</span></div></div>' +
    '<div class="grid g2"><button class="tab ' + (sec === "upload" ? "on" : "") + '" onclick="setSec(\'upload\')"><h3>1. Upload Item</h3><span>You found an item in class</span></button>' +
    '<button class="tab ' + (sec === "search" ? "on" : "") + '" onclick="setSec(\'search\')"><h3>2. Search Item</h3><span>Find your lost item and claim it</span></button></div>' +
    (mn.length ? '<div class="card"><h3>My updates</h3>' + mn.map(function (n) { return '<div class="note">' + esc(n.text) + "<br><small>" + ago(n.t) + "</small></div>"; }).join("") + "</div>" : "") +
    "<div>" + (sec === "upload" ? uploadView() : searchView()) + "</div>";
}
function setSec(s) { sec = s; render(); }

function card(i, act, top) {
  return '<div class="card item">' + (top ? '<div class="row" style="justify-content:flex-end;margin-bottom:8px">' + top + "</div>" : "") + (i.img ? '<img src="' + i.img + '" alt="">' : '<div class="ph">No photo</div>') +
    "<h4>" + esc(i.title) + ' <span class="badge ' + (i.status === "returned" ? "b-c" : "b-p") + '">' + (i.status === "returned" ? "Returned" : "Pending") + "</span></h4>" +
    "<p>" + esc(i.desc) + "</p><p>📍 " + esc(i.place || "-") + " · " + ago(i.t) + "</p><p>Found by " + esc(i.byName) + '</p><div style="margin-top:8px">' + (act || "") + "</div></div>";
}

/* ---------- section 1: Upload Item (finder) ---------- */
function uploadView() {
  var my = db.items.filter(function (i) { return isAdmin() || i.by === me.id; });
  return '<div class="card"><h3>Upload the item you found</h3><label>Item name</label><input id="lt" maxlength="60" placeholder="e.g. Bottle, book, charger">' +
    '<label>Description (colour, brand, marks)</label><textarea id="ld"></textarea><label>Where did you find it?</label><input id="lp" placeholder="e.g. Room E-204">' +
    '<label>Photo</label><input type="file" accept="image/*" onchange="pick(this)"><div id="prev" style="margin-top:8px"></div>' +
    '<div style="margin-top:14px"><button class="btn" onclick="submitItem()">Upload</button></div></div>' +
    '<h3 style="margin:18px 0 10px">' + (isAdmin() ? 'All uploads and claim requests (Admin)' : 'My uploads and claim requests') + '</h3>' +
    (my.length ? '<div class="grid gc">' + my.map(function (i) {
      var a = "";
      if (i.status === "pending") {
        var rq = i.claims.filter(function (c) { return c.status === "requested"; });
        a = rq.length ? rq.map(function (c) {
          return '<div class="note"><b>' + esc(c.byName) + "</b> (" + esc(c.by) + ")<br>Proof: " + esc(c.msg) +
            '<div class="row" style="margin-top:6px"><button class="btn s ok" onclick="decide(' + i.id + ",'" + c.by + '\',true)">Confirm and return</button><button class="btn s gh" onclick="decide(' + i.id + ",'" + c.by + '\',false)">Reject</button></div></div>';
        }).join("") : '<div class="sub">No claim requests yet.</div>';
      }
      return card(i, a, delBtn(i));
    }).join("") + "</div>" : '<div class="card empty">You have not uploaded anything yet.</div>');
}
function pick(inp) {
  var f = inp.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function () {
    var im = new Image();
    im.onload = function () {
      var s = Math.min(1, 420 / Math.max(im.width, im.height)), c = document.createElement("canvas");
      c.width = im.width * s; c.height = im.height * s; c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      photo = c.toDataURL("image/jpeg", 0.7);
      document.getElementById("prev").innerHTML = '<img src="' + photo + '" style="max-height:140px;border-radius:10px" alt="">';
    };
    im.src = r.result;
  };
  r.readAsDataURL(f);
}
function submitItem() {
  var t = document.getElementById("lt").value.trim();
  if (!t) { toast("Enter the item name"); return; }
  if (!photo) { toast("Please add a photo"); return; }
  db.items.unshift({ id: Date.now(), title: t, desc: document.getElementById("ld").value.trim(), place: document.getElementById("lp").value.trim(), img: photo, by: me.id, byName: me.name, status: "pending", claims: [], t: Date.now() });
  save(); photo = ""; toast("Item uploaded. Everyone can see it in notifications."); render();
}
function decide(id, by, ok) {
  var i = db.items.filter(function (x) { return x.id === id; })[0];
  if (!i || (!isAdmin() && i.by !== me.id)) { toast("Only the finder or Admin can manage claims"); return; }
  i.claims.forEach(function (c) { if (c.by === by && c.status === "requested") c.status = ok ? "approved" : "rejected"; else if (ok && c.status === "requested") c.status = "rejected"; });
  if (ok) i.status = "returned";
  db.notes.push({ to: by, text: "Your claim for " + i.title + " was " + (ok ? "confirmed. Collect it from " + me.name + " (" + me.id + ")." : "rejected."), t: Date.now() });
  save(); toast(ok ? "Item marked as returned" : "Claim rejected"); render();
}

/* ---------- delete: uploader or Admin can delete an item ---------- */
var delArm = null, delT;
function delBtn(i) {
  if (!me || (!isAdmin() && i.by !== me.id)) return "";
  return '<button class="btn s no" onclick="askDelete(' + i.id + ')">' + (delArm === i.id ? "Click again to confirm delete" : "🗑 Delete (wrong upload)") + "</button>";
}
function askDelete(id) {
  if (delArm === id) { deleteItem(id); return; }
  delArm = id; render(); clearTimeout(delT); delT = setTimeout(function () { delArm = null; if (me) render(); }, 4000);
}
function deleteItem(id) {
  var i = db.items.filter(function (x) { return x.id === id; })[0];
  if (!me || !i) { delArm = null; render(); return; }
  if (!isAdmin() && i.by !== me.id) { toast("You can delete only your own uploads"); delArm = null; render(); return; }
  i.claims.forEach(function (c) { if (c.status === "requested") db.notes.push({ to: c.by, text: "The item " + i.title + " you claimed was removed by the finder.", t: Date.now() }); });
  db.items = db.items.filter(function (x) { return x.id !== id; });
  save(); delArm = null; toast(isAdmin() && i.by !== me.id ? "Item deleted by Admin" : "Your item was deleted"); render();
}

/* ---------- section 2: Search Item (owner) ---------- */
function searchView() {
  return '<div class="card"><h3>Search your lost item</h3><input id="q" value="' + esc(q) + '" placeholder="Type item name, colour, place..." oninput="q=this.value;list()">' +
    '<div class="sub" style="margin-top:6px">All uploaded items are shown. If one is yours, click Claim and the finder will confirm.</div></div><div id="lst"></div>';
}
function lev(a, b) {
  var m = a.length, n = b.length, d = [], i, k;
  for (i = 0; i <= m; i++) d[i] = [i];
  for (k = 1; k <= n; k++) d[0][k] = k;
  for (i = 1; i <= m; i++) for (k = 1; k <= n; k++)
    d[i][k] = Math.min(d[i - 1][k] + 1, d[i][k - 1] + 1, d[i - 1][k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
  return d[m][n];
}
/* relevance score: title match > description/place match > similar spelling (typo tolerant) */
function score(i, s) {
  if (!s) return 0;
  var t = norm(i.title), d = norm(i.desc + " " + i.place), toks = (t + " " + d).split(" "), sc = 0;
  s.split(" ").forEach(function (w) {
    if (!w) return;
    if (t === w) sc += 8;
    else if (t.indexOf(w) > -1) sc += 5;
    else if (d.indexOf(w) > -1) sc += 2;
    else if (w.length > 2 && toks.some(function (x) { return lev(x, w) <= (w.length > 4 ? 2 : 1); })) sc += 1;
  });
  return sc;
}
function itemHTML(i) {
  var my = i.claims.filter(function (c) { return c.by === me.id; })[0], a;
  if (i.status === "returned") a = '<span class="sub">Already returned to its owner.</span>';
  else if (i.by === me.id) a = '<button class="btn" style="width:100%" disabled title="You uploaded this item">Claim this item</button><div class="sub" style="margin-top:6px">You uploaded this item. The owner will claim it from their own login.</div>';
  else if (my) a = '<span class="badge ' + (my.status === "rejected" ? "b-r" : "b-p") + '">Your claim: ' + my.status + "</span>";
  else a = '<input id="m' + i.id + '" placeholder="Proof: unique mark / what is inside" style="margin-bottom:6px"><button class="btn" style="width:100%" onclick="claim(' + i.id + ')">This is my item - Claim</button>';
  return card(i, a);
}
function list() {
  var s = norm(q), el = document.getElementById("lst");
  if (!db.items.length) { el.innerHTML = '<div class="card empty">No items uploaded yet.</div>'; return; }
  var l = db.items.map(function (i) { return { i: i, sc: score(i, s) }; });
  l.sort(function (a, b) { return b.sc - a.sc || b.i.t - a.i.t; });
  var hit = l.filter(function (x) { return x.sc > 0; }), rest = l.filter(function (x) { return x.sc === 0; });
  function grid(arr) { return '<div class="grid gc">' + arr.map(function (x) { return itemHTML(x.i); }).join("") + "</div>"; }
  if (!s) { el.innerHTML = grid(l); return; }
  el.innerHTML = (hit.length ? '<h3 style="margin:6px 0 10px">Best matches (' + hit.length + ")</h3>" + grid(hit) : '<div class="card empty">No match for "' + esc(q) + '". Showing all items below.</div>') +
    (hit.length && rest.length ? '<h3 style="margin:14px 0 10px">Other items</h3>' : "") + (rest.length ? grid(rest) : "");
}
function claim(id) {
  var i = db.items.filter(function (x) { return x.id === id; })[0];
  if (!i || i.status === "returned") { toast("This item is no longer available"); return; }
  var m = document.getElementById("m" + id).value.trim();
  if (!m) { toast("Add a proof or description"); return; }
  i.claims.push({ by: me.id, byName: me.name, msg: m, status: "requested" });
  db.notes.push({ to: i.by, text: me.name + " (" + me.id + ") claims the item you uploaded: " + i.title + ". Open Upload Item to confirm.", t: Date.now() });
  save(); toast("Claim sent. The finder will confirm."); list();
}

function render() {
  renderBoard();
  document.getElementById("main").innerHTML = me ? appView() : loginView();
  if (me && sec === "search") list();
}
render();
startFirebase();
