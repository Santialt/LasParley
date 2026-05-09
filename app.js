const LOCAL_BACKUP_KEY = "apuestas-finde-bets-v2";
const ACCESS_STORAGE_KEY = "las-parley-access-ok";
const ACCESS_CODE = "parley";
const SUPABASE_URL = "https://nqpfjzizpcpuppuosazf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EsKSvxHNvARcaNfdxYx1UA_0wBg4kDR";
const betsTable = "bets";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const state = {
  bets: [],
  filter: "all",
  search: "",
  loading: false,
};

const statusLabels = {
  pending: "Pendiente",
  won: "Verde",
  lost: "Roja",
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const betForm = document.querySelector("#betForm");
const betList = document.querySelector("#betList");
const emptyState = document.querySelector("#emptyState");
const template = document.querySelector("#betCardTemplate");
const activeCount = document.querySelector("#activeCount");
const activeStake = document.querySelector("#activeStake");
const settledStake = document.querySelector("#settledStake");
const totalBalance = document.querySelector("#totalBalance");
const groupStats = document.querySelector("#groupStats");
const weekStrip = document.querySelector("#weekStrip");
const searchInput = document.querySelector("#searchInput");
const exportButton = document.querySelector("#exportButton");
const importInput = document.querySelector("#importInput");
const loginScreen = document.querySelector("#loginScreen");
const loginForm = document.querySelector("#loginForm");
const accessCodeInput = document.querySelector("#accessCodeInput");
const loginError = document.querySelector("#loginError");
const siteContent = document.querySelector("#siteContent");
const logoutButton = document.querySelector("#logoutButton");

initAccessGate();

document.querySelector("#dateInput").valueAsDate = new Date();

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (accessCodeInput.value.trim() !== ACCESS_CODE) {
    loginError.textContent = "Clave incorrecta. Esta mesa no es para cualquiera.";
    accessCodeInput.select();
    return;
  }

  sessionStorage.setItem(ACCESS_STORAGE_KEY, "true");
  unlockApp();
});

logoutButton.addEventListener("click", () => {
  sessionStorage.removeItem(ACCESS_STORAGE_KEY);
  document.body.classList.add("is-locked");
  loginScreen.hidden = false;
  siteContent.setAttribute("aria-hidden", "true");
  accessCodeInput.value = "";
  loginError.textContent = "";
  accessCodeInput.focus();
});

betForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(betForm);
  const bet = {
    event: formData.get("event").trim(),
    date: formData.get("date"),
    amount: Number(formData.get("amount")) || 0,
    odds: Number(formData.get("odds")) || 1,
    book: formData.get("book").trim(),
    friend: formData.get("friend").trim() || "Grupo",
    pick: formData.get("pick").trim(),
    notes: formData.get("notes").trim(),
    status: "pending",
  };

  try {
    await createBet(bet);
    betForm.reset();
    document.querySelector("#dateInput").valueAsDate = new Date();
  } catch (error) {
    showDataError(error);
  }
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    state.filter = tab.dataset.filter;
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("is-active"));
    tab.classList.add("is-active");
    render();
  });
});

searchInput.addEventListener("input", () => {
  state.search = searchInput.value.trim().toLowerCase();
  render();
});

betList.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  const card = event.target.closest(".bet-card");
  if (!button || !card) return;

  const bet = state.bets.find((item) => item.id === card.dataset.id);
  if (!bet) return;

  if (button.dataset.action === "delete") {
    try {
      await deleteBet(bet.id);
    } catch (error) {
      showDataError(error);
    }
    return;
  }

  if (button.dataset.status) {
    try {
      await updateBetStatus(bet.id, button.dataset.status);
    } catch (error) {
      showDataError(error);
    }
  }
});

exportButton.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state.bets, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `penca-finde-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error("Formato invalido");
    await importBets(imported.filter(isValidBet));
  } catch {
    alert("No pude importar ese archivo. Revisa que sea un JSON exportado desde esta app.");
  } finally {
    importInput.value = "";
  }
});

function render() {
  const visibleBets = getVisibleBets();
  betList.innerHTML = "";
  visibleBets.forEach((bet) => betList.appendChild(createBetCard(bet)));

  if (state.loading) {
    emptyState.querySelector("h2").textContent = "Cargando tickets...";
    emptyState.querySelector("p").textContent = "Estamos trayendo la banca desde Supabase.";
  } else {
    emptyState.querySelector("h2").textContent = "Todavia no hay tickets";
    emptyState.querySelector("p").textContent = "Carguen la primera apuesta grupal y el tablero va llevando stake, cuota y balance.";
  }

  emptyState.classList.toggle("is-visible", visibleBets.length === 0);
  renderSummary();
  renderWeeks();
  renderGroupStats();
}

function createBetCard(bet) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.dataset.id = bet.id;
  node.querySelector(".bet-date").textContent = formatDate(bet.date);
  node.querySelector(".bet-event").textContent = bet.event;
  node.querySelector(".bet-friend").textContent = bet.friend;
  node.querySelector(".bet-pick").textContent = bet.pick;
  node.querySelector(".bet-amount").textContent = `Stake ${formatMoney(bet.amount)}`;
  node.querySelector(".bet-odds").textContent = `Cuota ${formatOdds(bet.odds)}`;
  node.querySelector(".bet-book").textContent = bet.book ? `Casa ${bet.book}` : "";
  node.querySelector(".bet-return").textContent = getBetReturnLabel(bet);
  node.querySelector(".bet-notes").textContent = bet.notes;

  const pill = node.querySelector(".status-pill");
  pill.textContent = statusLabels[bet.status];
  pill.classList.add(`status-${bet.status}`);

  node.querySelectorAll("[data-status]").forEach((button) => {
    button.disabled = button.dataset.status === bet.status;
  });

  return node;
}

function renderSummary() {
  const active = state.bets.filter((bet) => bet.status === "pending");
  const settled = state.bets.filter((bet) => bet.status !== "pending");
  const pendingStake = active.reduce((total, bet) => total + bet.amount, 0);
  const closedStake = settled.reduce((total, bet) => total + bet.amount, 0);
  const balance = state.bets.reduce((total, bet) => total + calculateProfit(bet), 0);

  activeCount.textContent = active.length;
  activeStake.textContent = formatMoney(pendingStake);
  settledStake.textContent = formatMoney(closedStake);
  totalBalance.textContent = formatSignedMoney(balance);
  totalBalance.classList.toggle("is-positive", balance > 0);
  totalBalance.classList.toggle("is-negative", balance < 0);
}

function renderWeeks() {
  const weeks = [...new Set(state.bets.map((bet) => getWeekendLabel(bet.date)))].filter(Boolean);
  weekStrip.innerHTML = "";

  weeks.slice(0, 10).forEach((week) => {
    const chip = document.createElement("span");
    chip.className = "week-chip";
    chip.textContent = week;
    weekStrip.appendChild(chip);
  });
}

function renderGroupStats() {
  groupStats.innerHTML = "";

  if (!state.bets.length) {
    const empty = document.createElement("p");
    empty.className = "bet-notes";
    empty.textContent = "Sin datos todavia.";
    groupStats.appendChild(empty);
    return;
  }

  const settled = state.bets.filter((bet) => bet.status !== "pending");
  const won = state.bets.filter((bet) => bet.status === "won").length;
  const lost = state.bets.filter((bet) => bet.status === "lost").length;
  const pending = state.bets.filter((bet) => bet.status === "pending").length;
  const totalStake = settled.reduce((total, bet) => total + bet.amount, 0);
  const balance = settled.reduce((total, bet) => total + calculateProfit(bet), 0);
  const roi = totalStake ? (balance / totalStake) * 100 : 0;
  const hitRate = settled.length ? (won / settled.length) * 100 : 0;

  [
    ["Tickets cerrados", settled.length],
    ["Verdes / rojas", `${won} / ${lost}`],
    ["Pendientes", pending],
    ["Efectividad", `${hitRate.toFixed(1)}%`],
    ["ROI", `${roi > 0 ? "+" : ""}${roi.toFixed(1)}%`],
    ["Balance", formatSignedMoney(balance)],
  ].forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "leaderboard-row";
    row.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
    groupStats.appendChild(row);
  });
}

function getVisibleBets() {
  return state.bets.filter((bet) => {
    const matchesFilter = state.filter === "all" || bet.status === state.filter;
    const haystack = `${bet.event} ${bet.friend} ${bet.pick} ${bet.notes} ${bet.book}`.toLowerCase();
    return matchesFilter && haystack.includes(state.search);
  });
}

function getWeekendLabel(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T12:00:00`);
  const day = date.getDay();
  const saturday = new Date(date);
  saturday.setDate(date.getDate() + ((6 - day + 7) % 7));
  return `Finde ${dateFormatter.format(saturday)}`;
}

function formatDate(dateString) {
  if (!dateString) return "Sin fecha";
  return dateFormatter.format(new Date(`${dateString}T12:00:00`));
}

function formatMoney(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatSignedMoney(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatMoney(value)}`;
}

function formatOdds(value) {
  return (Number(value) || 1).toFixed(2);
}

function calculateProfit(bet) {
  if (bet.status === "won") return bet.amount * ((Number(bet.odds) || 1) - 1);
  if (bet.status === "lost") return -bet.amount;
  return 0;
}

function getBetReturnLabel(bet) {
  if (bet.status === "pending") {
    return `Posible cobro ${formatMoney(bet.amount * (Number(bet.odds) || 1))}`;
  }

  return `Balance ${formatSignedMoney(calculateProfit(bet))}`;
}

function isValidBet(bet) {
  return bet && bet.id && bet.event && bet.date && bet.friend && bet.pick && bet.status && bet.odds;
}

function initAccessGate() {
  if (sessionStorage.getItem(ACCESS_STORAGE_KEY) === "true") {
    unlockApp();
    return;
  }

  document.body.classList.add("is-locked");
  loginScreen.hidden = false;
  siteContent.setAttribute("aria-hidden", "true");
  requestAnimationFrame(() => accessCodeInput.focus());
}

function unlockApp() {
  document.body.classList.remove("is-locked");
  loginScreen.hidden = true;
  siteContent.setAttribute("aria-hidden", "false");
  loadRemoteBets();
}

async function loadRemoteBets() {
  state.loading = true;
  render();

  const { data, error } = await supabaseClient
    .from(betsTable)
    .select("*")
    .order("created_at", { ascending: false });

  state.loading = false;
  if (error) {
    state.bets = loadLocalBackup();
    render();
    showDataError(error);
    return;
  }

  state.bets = data.map(normalizeBet);
  saveLocalBackup();
  render();
}

async function createBet(bet) {
  const { data, error } = await supabaseClient
    .from(betsTable)
    .insert(toDatabaseBet(bet))
    .select()
    .single();

  if (error) throw error;
  state.bets.unshift(normalizeBet(data));
  saveLocalBackup();
  render();
}

async function updateBetStatus(id, status) {
  const { data, error } = await supabaseClient
    .from(betsTable)
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  state.bets = state.bets.map((bet) => (bet.id === id ? normalizeBet(data) : bet));
  saveLocalBackup();
  render();
}

async function deleteBet(id) {
  const { error } = await supabaseClient.from(betsTable).delete().eq("id", id);
  if (error) throw error;
  state.bets = state.bets.filter((bet) => bet.id !== id);
  saveLocalBackup();
  render();
}

async function importBets(bets) {
  const rows = bets.map(toDatabaseBet);
  const { data, error } = await supabaseClient.from(betsTable).upsert(rows).select();
  if (error) throw error;
  state.bets = data.map(normalizeBet).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  saveLocalBackup();
  render();
}

function normalizeBet(row) {
  return {
    id: row.id,
    event: row.event,
    date: row.date,
    amount: Number(row.amount) || 0,
    odds: Number(row.odds) || 1,
    book: row.book ?? "",
    friend: row.friend ?? "Grupo",
    pick: row.pick,
    notes: row.notes ?? "",
    status: row.status,
    createdAt: row.created_at,
  };
}

function toDatabaseBet(bet) {
  return {
    id: bet.id,
    event: bet.event,
    date: bet.date,
    amount: bet.amount,
    odds: bet.odds,
    book: bet.book,
    friend: bet.friend || "Grupo",
    pick: bet.pick,
    notes: bet.notes,
    status: bet.status,
  };
}

function saveLocalBackup() {
  localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(state.bets));
}

function loadLocalBackup() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_BACKUP_KEY)) ?? [];
  } catch {
    return [];
  }
}

function showDataError(error) {
  console.error(error);
  alert("No pude sincronizar con Supabase. Revisa que la tabla bets exista y que las politicas permitan leer/escribir.");
}

render();
