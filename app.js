const STORAGE_KEY = "apuestas-finde-bets-v2";

const state = {
  bets: loadBets(),
  filter: "all",
  search: "",
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

document.querySelector("#dateInput").valueAsDate = new Date();

betForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(betForm);
  const bet = {
    id: crypto.randomUUID(),
    event: formData.get("event").trim(),
    date: formData.get("date"),
    amount: Number(formData.get("amount")) || 0,
    odds: Number(formData.get("odds")) || 1,
    book: formData.get("book").trim(),
    friend: formData.get("friend").trim() || "Grupo",
    pick: formData.get("pick").trim(),
    notes: formData.get("notes").trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  state.bets.unshift(bet);
  saveBets();
  betForm.reset();
  document.querySelector("#dateInput").valueAsDate = new Date();
  render();
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

betList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  const card = event.target.closest(".bet-card");
  if (!button || !card) return;

  const bet = state.bets.find((item) => item.id === card.dataset.id);
  if (!bet) return;

  if (button.dataset.action === "delete") {
    state.bets = state.bets.filter((item) => item.id !== bet.id);
  }

  if (button.dataset.status) {
    bet.status = button.dataset.status;
  }

  saveBets();
  render();
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
    state.bets = imported.filter(isValidBet);
    saveBets();
    render();
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

function loadBets() {
  try {
    const latest = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (latest) return latest;

    const old = JSON.parse(localStorage.getItem("penca-finde-bets-v1")) ?? [];
    return old.map((bet) => ({ ...bet, odds: bet.odds ?? 2, book: bet.book ?? "" }));
  } catch {
    return [];
  }
}

function saveBets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bets));
}

function isValidBet(bet) {
  return bet && bet.id && bet.event && bet.date && bet.friend && bet.pick && bet.status && bet.odds;
}

render();
