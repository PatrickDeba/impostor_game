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
  dealPanel: document.getElementById("dealPanel"),

  // start
  starterName: document.getElementById("starterName"),
  backToMenuBtn: document.getElementById("backToMenuBtn"),
  reviewCardsBtn: document.getElementById("reviewCardsBtn"),

  // modal
  modal: document.getElementById("modal"),
  modalText: document.getElementById("modalText"),
  modalYes: document.getElementById("modalYes"),
  modalNo: document.getElementById("modalNo"),
  revealFront: document.getElementById("revealFront"),
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
  el.impostorMaxHint.textContent = `Max: ${max}`;
  el.impostorCount.value = String(state.impostorCount);
}

/* =========================
   Confirm modal
========================= */
let confirmOnYes = null;

function showConfirm(message, onYes){
  confirmOnYes = typeof onYes === "function" ? onYes : null;
  el.modalText.textContent = message;
  el.modal.classList.remove("hidden");
  el.modal.setAttribute("aria-hidden", "false");
}

function hideConfirm(){
  el.modal.classList.add("hidden");
  el.modal.setAttribute("aria-hidden", "true");
  confirmOnYes = null;
}

el.modalNo.addEventListener("click", hideConfirm);

el.modalYes.addEventListener("click", () => {
  const fn = confirmOnYes;
  hideConfirm();
  if (fn) fn();
});

// Close if tap on backdrop
el.modal.addEventListener("click", (e) => {
  if (e.target === el.modal) hideConfirm();
});

/* =========================
   Players list (render only)
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

  el.playersHelp.textContent = `Mínimo 3. (${state.players.length})`;
  el.playersHelp.style.color = (state.players.length < 3 || hasDup) ? "var(--danger)" : "var(--muted)";

  state.players.forEach((name, idx) => {
    const item = document.createElement("div");
    item.className = "player-item";
    item.dataset.index = String(idx);

    const left = document.createElement("div");
    left.className = "player-left";

    const nm = document.createElement("div");
    nm.className = "player-name";
    nm.textContent = name;

    left.appendChild(nm);

    const actions = document.createElement("div");
    actions.className = "player-actions";

    const del = document.createElement("button");
    del.className = "small-btn";
    del.type = "button";
    del.textContent = "🗑";
    del.setAttribute("aria-label", `Eliminar ${name}`);
    del.addEventListener("click", () => {
      showConfirm(`¿Estás seguro de que quieres borrar el jugador ${name}?`, () => {
        state.players.splice(idx, 1);
        clampImpostors();
        renderPlayers();
      });
    });

    actions.appendChild(del);
    item.appendChild(left);
    item.appendChild(actions);
    el.playersList.appendChild(item);
  });

  clampImpostors();
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
  clearError();

  // Choose the secret word (always), and optionally reveal a hint to impostors
  state.selectedHint = HINTS[Math.floor(Math.random() * HINTS.length)];

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

  el.dealPanel.classList.remove("slide-transition");
  void el.dealPanel.offsetWidth;
  el.dealPanel.classList.add("slide-transition");
}

function showRole(){
  const idx = state.dealIndex;
  const isImpostor = state.impostorSet.has(idx);

  el.roleTitle.textContent = isImpostor ? "Impostor" : "Civil";

  // Civils see the word; impostors see the hint (if enabled)
  if (!state.selectedHint) {
    // Safety fallback
    el.roleHint.textContent = "";
    el.roleHint.classList.add("hidden");
  } else if (!isImpostor) {
    el.roleHint.textContent = `La palabra es: ${state.selectedHint.solution}`;
    el.roleHint.classList.remove("hidden");
  } else if (state.hintsEnabled) {
    const level = state.hintLevel;
    const hint = level === 1 ? state.selectedHint.l1 : level === 2 ? state.selectedHint.l2 : state.selectedHint.l3;
    el.roleHint.textContent = `Tu pista es: ${hint}`;
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
  threshold: 160, // px upwards to reveal (more intentional)
  maxLift: 220,
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

  // translate front layer for feel
  const lift = Math.min(up, reveal.maxLift);
  el.revealFront.style.transform = `translateY(${-lift}px)`;

  if (lift >= reveal.threshold) {
    showRole();
  } else {
    hideRole();
  }
});

function endReveal(){
  reveal.active = false;
  el.revealFront.style.transform = "translateY(0)";
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

function reviewCards(){
  // Re-open the same deal (same impostors + same word/pistas)
  if (!state.selectedHint || !state.impostorSet || state.players.length < 3) {
    showError("No hay una partida anterior para revisar.");
    setView("menu");
    return;
  }

  state.dealIndex = 0;
  updateDealUI();
  setView("deal");
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
  hideRole();
  nextStep();

  // extra subtle feedback
  if (!el.viewDeal.classList.contains("hidden")){
    el.dealPanel.classList.remove("slide-transition");
    void el.dealPanel.offsetWidth;
    el.dealPanel.classList.add("slide-transition");
  }
});

el.exitBtn.addEventListener("click", () => {
  showConfirm("¿Estás seguro de que quieres salir del juego?", () => {
    state.selectedHint = null;
    state.impostorSet = new Set();
    state.dealIndex = 0;
    setView("menu");
    clearError();
  });
});

el.backToMenuBtn.addEventListener("click", () => {
  state.selectedHint = null;
  state.impostorSet = new Set();
  state.dealIndex = 0;
  setView("menu");
  clearError();
});

el.reviewCardsBtn.addEventListener("click", () => {
  clearError();
  reviewCards();
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