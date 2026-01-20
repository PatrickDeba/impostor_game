/* =========================
   State
========================= */
const state = {
  players: ["Jugador 1", "Jugador 2", "Jugador 3"],
  impostorCount: 1,
  hintsEnabled: false,
  hintLevel: 1, // 1..3
  // runtime
  dealIndex: 0,
  impostorSet: new Set(),
  selectedHint: null, // placeholder (JSON al final)
};

/* =========================
   DOM
========================= */
const el = {
  // views
  viewMenu: document.getElementById("viewMenu"),
  viewDeal: document.getElementById("viewDeal"),
  viewStart: document.getElementById("viewStart"),

  // header
  exitBtn: document.getElementById("exitBtn"),

  // menu
  playerNameInput: document.getElementById("playerNameInput"),
  addPlayerBtn: document.getElementById("addPlayerBtn"),
  playersList: document.getElementById("playersList"),
  playersHelp: document.getElementById("playersHelp"),
  impostorCount: document.getElementById("impostorCount"),
  impostorMaxHint: document.getElementById("impostorMaxHint"),
  hintsToggle: document.getElementById("hintsToggle"),
  hintLevel: document.getElementById("hintLevel"),
  startBtn: document.getElementById("startBtn"),
  errorBox: document.getElementById("errorBox"),

  // deal
  currentPlayerName: document.getElementById("currentPlayerName"),
  progressPill: document.getElementById("progressPill"),
  revealCard: document.getElementById("revealCard"),
  roleContent: document.getElementById("roleContent"),
  roleTitle: document.getElementById("roleTitle"),
  roleHint: document.getElementById("roleHint"),
  nextBtn: document.getElementById("nextBtn"),

  // start
  starterName: document.getElementById("starterName"),
  backToMenuBtn: document.getElementById("backToMenuBtn"),
};

/* =========================
   Helpers
========================= */
function normName(s){
  return s.trim().replace(/\s+/g, " ");
}
function keyName(s){
  return normName(s).toLocaleLowerCase("es-ES");
}
function showError(msg){
  el.errorBox.textContent = msg;
  el.errorBox.classList.remove("hidden");
}
function clearError(){
  el.errorBox.classList.add("hidden");
  el.errorBox.textContent = "";
}
function setView(name){
  el.viewMenu.classList.toggle("hidden", name !== "menu");
  el.viewDeal.classList.toggle("hidden", name !== "deal");
  el.viewStart.classList.toggle("hidden", name !== "start");
  el.exitBtn.classList.toggle("hidden", name === "menu");
}
function clampImpostors(){
  const max = Math.max(0, state.players.length - 1);
  state.impostorCount = Math.min(state.impostorCount, max);
  el.impostorCount.max = String(max);
  el.impostorMaxHint.textContent = `Máximo: ${max}`;
  el.impostorCount.value = String(state.impostorCount);
}

/* =========================
   Players list (render + reorder)
========================= */
function renderPlayers(){
  el.playersList.innerHTML = "";

  const seen = new Set();
  let hasDup = false;
  for (const p of state.players){
    const k = keyName(p);
    if (seen.has(k)) hasDup = true;
    seen.add(k);
  }

  el.playersHelp.textContent = `Mínimo 3. Sin duplicados. (${state.players.length})`;
  el.playersHelp.style.color = (state.players.length < 3 || hasDup) ? "var(--danger)" : "var(--muted)";

  state.players.forEach((name, idx) => {
    const item = document.createElement("div");
    item.className = "player-item";
    item.dataset.index = String(idx);

    const left = document.createElement("div");
    left.className = "player-left";

    const drag = document.createElement("div");
    drag.className = "drag";
    drag.textContent = "≡";
    drag.setAttribute("role", "button");
    drag.setAttribute("aria-label", "Reordenar");

    const nm = document.createElement("div");
    nm.className = "player-name";
    nm.textContent = name;

    left.appendChild(drag);
    left.appendChild(nm);

    const actions = document.createElement("div");
    actions.className = "player-actions";

    const del = document.createElement("button");
    del.className = "small-btn";
    del.type = "button";
    del.textContent = "🗑";
    del.setAttribute("aria-label", `Eliminar ${name}`);
    del.addEventListener("click", () => {
      state.players.splice(idx, 1);
      clampImpostors();
      renderPlayers();
    });

    actions.appendChild(del);
    item.appendChild(left);
    item.appendChild(actions);
    el.playersList.appendChild(item);

    setupDragHandle(drag, item);
  });

  clampImpostors();
}

// Simple touch reorder (mobile)
let dragCtx = null;
function setupDragHandle(handle, item){
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const rect = item.getBoundingClientRect();
    dragCtx = {
      startY: e.clientY,
      fromIndex: Number(item.dataset.index),
      item,
      rect,
    };
    item.style.opacity = "0.65";
    item.setPointerCapture(e.pointerId);
  });

  handle.addEventListener("pointermove", (e) => {
    if (!dragCtx) return;
    e.preventDefault();

    const y = e.clientY;
    const dy = y - dragCtx.startY;

    // move visual
    dragCtx.item.style.transform = `translateY(${dy}px)`;

    // swap logic: find hovered item center
    const items = [...document.querySelectorAll(".player-item")];
    const from = dragCtx.fromIndex;

    let targetIndex = from;
    for (const it of items){
      if (it === dragCtx.item) continue;
      const r = it.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (y < mid && Number(it.dataset.index) < from) {
        targetIndex = Number(it.dataset.index);
        break;
      }
      if (y > mid && Number(it.dataset.index) > from) {
        targetIndex = Number(it.dataset.index);
      }
    }

    if (targetIndex !== from){
      const moved = state.players.splice(from, 1)[0];
      state.players.splice(targetIndex, 0, moved);
      renderPlayers(); // re-render updates indices
      dragCtx = null;  // end drag to keep it clean
    }
  });

  handle.addEventListener("pointerup", () => {
    if (!dragCtx) return;
    dragCtx.item.style.opacity = "";
    dragCtx.item.style.transform = "";
    dragCtx = null;
  });

  handle.addEventListener("pointercancel", () => {
    if (!dragCtx) return;
    dragCtx.item.style.opacity = "";
    dragCtx.item.style.transform = "";
    dragCtx = null;
  });
}

/* =========================
   Deal logic
========================= */
function validateConfig(){
  clearError();
  const n = state.players.length;
  if (n < 3) return "Debe haber al menos 3 jugadores.";

  // duplicates
  const seen = new Set();
  for (const p of state.players){
    const k = keyName(p);
    if (!k) return "Hay un jugador con nombre vacío.";
    if (seen.has(k)) return "No se permiten nombres duplicados.";
    seen.add(k);
  }

  const maxImp = n - 1;
  if (state.impostorCount < 0 || state.impostorCount > maxImp) {
    return `Impostores debe estar entre 0 y ${maxImp}.`;
  }

  return null;
}

function pickImpostors(){
  state.impostorSet = new Set();
  const n = state.players.length;
  const k = state.impostorCount;

  // sample without replacement
  const indices = Array.from({length:n}, (_,i)=>i);
  shuffle(indices);
  for (let i=0; i<k; i++){
    state.impostorSet.add(indices[i]);
  }
}

function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function startDeal(){
  const err = validateConfig();
  if (err) { showError(err); return; }

  pickImpostors();

  // hints: placeholder (JSON al final)
  state.selectedHint = state.hintsEnabled ? {
    solution: "Tarta de queso",
    l1: "Postre",
    l2: "Dulce con queso",
    l3: "Comida"
  } : null;

  state.dealIndex = 0;
  updateDealUI();
  setView("deal");
}

function updateDealUI(){
  const idx = state.dealIndex;
  const n = state.players.length;

  el.currentPlayerName.textContent = state.players[idx];
  el.progressPill.textContent = `${idx+1}/${n}`;

  // set button label
  if (idx === n - 1) el.nextBtn.textContent = "Comenzar juego";
  else el.nextBtn.textContent = "Siguiente jugador";

  // reset reveal state
  hideRole();
}

function showRole(){
  const idx = state.dealIndex;
  const isImpostor = state.impostorSet.has(idx);

  el.roleTitle.textContent = isImpostor ? "Impostor" : "Civil";

  if (isImpostor && state.hintsEnabled && state.selectedHint){
    const level = state.hintLevel;
    const hint = level === 1 ? state.selectedHint.l1 : level === 2 ? state.selectedHint.l2 : state.selectedHint.l3;
    el.roleHint.textContent = hint;
    el.roleHint.classList.remove("hidden");
  } else {
    el.roleHint.textContent = "";
    el.roleHint.classList.add("hidden");
  }

  el.revealCard.classList.add("revealed");
  el.roleContent.setAttribute("aria-hidden", "false");
}
function hideRole(){
  el.revealCard.classList.remove("revealed");
  el.roleContent.setAttribute("aria-hidden", "true");
  el.roleHint.classList.add("hidden");
}

/* =========================
   Hold + drag up to reveal
========================= */
const reveal = {
  active: false,
  startY: 0,
  currentY: 0,
  threshold: 90, // px upwards to reveal
};

el.revealCard.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  reveal.active = true;
  reveal.startY = e.clientY;
  reveal.currentY = e.clientY;
  el.revealCard.setPointerCapture(e.pointerId);
});

el.revealCard.addEventListener("pointermove", (e) => {
  if (!reveal.active) return;
  e.preventDefault();
  reveal.currentY = e.clientY;

  const dy = reveal.currentY - reveal.startY; // negative when moving up
  const up = Math.max(0, -dy);

  // translate card slightly for feel
  const t = Math.min(up, 140);
  el.revealCard.style.transform = `translateY(${-t/8}px)`;

  if (up >= reveal.threshold) {
    showRole();
  } else {
    hideRole();
  }
});

function endReveal(){
  reveal.active = false;
  el.revealCard.style.transform = "";
  hideRole();
}

el.revealCard.addEventListener("pointerup", (e) => {
  if (!reveal.active) return;
  e.preventDefault();
  endReveal();
});
el.revealCard.addEventListener("pointercancel", endReveal);
el.revealCard.addEventListener("pointerleave", () => {
  // safety: if pointer leaves while active
  if (reveal.active) endReveal();
});

/* =========================
   Next / Start game
========================= */
function nextStep(){
  const n = state.players.length;

  if (state.dealIndex < n - 1){
    state.dealIndex += 1;
    updateDealUI();
    return;
  }

  // last player -> show starter
  const starter = state.players[Math.floor(Math.random() * n)];
  el.starterName.textContent = starter;
  setView("start");
}

/* =========================
   Events
========================= */
el.addPlayerBtn.addEventListener("click", () => {
  const raw = el.playerNameInput.value;
  const name = normName(raw);
  if (!name) return;

  // no duplicates
  const k = keyName(name);
  if (state.players.some(p => keyName(p) === k)) {
    showError("Ese nombre ya existe.");
    return;
  }

  state.players.push(name);
  el.playerNameInput.value = "";
  clampImpostors();
  renderPlayers();
  clearError();
});

el.playerNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") el.addPlayerBtn.click();
});

el.impostorCount.addEventListener("input", () => {
  const v = Number(el.impostorCount.value);
  state.impostorCount = Number.isFinite(v) ? v : 0;
  clampImpostors();
});

el.hintsToggle.addEventListener("change", () => {
  state.hintsEnabled = el.hintsToggle.checked;
  el.hintLevel.disabled = !state.hintsEnabled;
});

el.hintLevel.addEventListener("change", () => {
  state.hintLevel = Number(el.hintLevel.value);
});

el.startBtn.addEventListener("click", startDeal);

el.nextBtn.addEventListener("click", () => {
  // role is always hidden after release; still enforce:
  hideRole();
  nextStep();
});

el.exitBtn.addEventListener("click", () => {
  // exit to menu
  setView("menu");
  clearError();
});

el.backToMenuBtn.addEventListener("click", () => {
  setView("menu");
  clearError();
});

/* =========================
   Init
========================= */
function init(){
  setView("menu");
  el.hintsToggle.checked = state.hintsEnabled;
  el.hintLevel.disabled = !state.hintsEnabled;
  el.hintLevel.value = String(state.hintLevel);
  el.impostorCount.value = String(state.impostorCount);
  renderPlayers();
  clampImpostors();
}
init();