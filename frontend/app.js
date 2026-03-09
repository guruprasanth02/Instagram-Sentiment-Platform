/* ── app.js ──────────────────────────────────────────────────────────────────
   Instagram Sentiment Analyzer — Frontend Logic
   – Calls POST /predict via Fetch API
   – Updates Chart.js Pie + Bar charts after each prediction
   – Maintains session history table
─────────────────────────────────────────────────────────────────────────────── */

const API_BASE = "http://localhost:8000";

// ── Session state ─────────────────────────────────────────────────────────────
const state = {
  total: 0,
  positive: 0,
  neutral: 0,
  negative: 0,
  history: [],
};

// ── Chart.js instances ────────────────────────────────────────────────────────
let pieChart = null;
let barChart = null;

const CHART_COLORS = {
  positive: "rgba(34,197,94,0.85)",
  neutral:  "rgba(245,158,11,0.85)",
  negative: "rgba(239,68,68,0.85)",
};

const CHART_BORDERS = {
  positive: "#22c55e",
  neutral:  "#f59e0b",
  negative: "#ef4444",
};

function initCharts() {
  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: "#94a3b8", font: { family: "Inter", size: 12 } },
      },
    },
  };

  // Pie Chart
  const pieCtx = document.getElementById("pieChart").getContext("2d");
  pieChart = new Chart(pieCtx, {
    type: "doughnut",
    data: {
      labels: ["Positive", "Neutral", "Negative"],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: [CHART_COLORS.positive, CHART_COLORS.neutral, CHART_COLORS.negative],
        borderColor:      [CHART_BORDERS.positive, CHART_BORDERS.neutral, CHART_BORDERS.negative],
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: {
      ...chartDefaults,
      cutout: "65%",
      plugins: {
        ...chartDefaults.plugins,
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed} (${pct(ctx.parsed)}%)`,
          },
        },
      },
    },
  });

  // Bar Chart
  const barCtx = document.getElementById("barChart").getContext("2d");
  barChart = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: ["Positive", "Neutral", "Negative"],
      datasets: [{
        label: "Count",
        data: [0, 0, 0],
        backgroundColor: [CHART_COLORS.positive, CHART_COLORS.neutral, CHART_COLORS.negative],
        borderColor:      [CHART_BORDERS.positive, CHART_BORDERS.neutral, CHART_BORDERS.negative],
        borderWidth: 1.5,
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      ...chartDefaults,
      scales: {
        x: {
          grid:  { color: "rgba(255,255,255,0.04)" },
          ticks: { color: "#94a3b8", font: { family: "Inter" } },
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#94a3b8", font: { family: "Inter" }, stepSize: 1, precision: 0 },
          grid:  { color: "rgba(255,255,255,0.06)" },
        },
      },
    },
  });
}

function pct(value) {
  if (state.total === 0) return "0";
  return ((value / state.total) * 100).toFixed(1);
}

// ── Update charts & counters ──────────────────────────────────────────────────
function updateDashboard() {
  document.getElementById("total-analyzed").textContent = state.total;
  document.getElementById("positive-count").textContent = state.positive;
  document.getElementById("neutral-count").textContent  = state.neutral;
  document.getElementById("negative-count").textContent = state.negative;

  pieChart.data.datasets[0].data = [state.positive, state.neutral, state.negative];
  barChart.data.datasets[0].data = [state.positive, state.neutral, state.negative];
  pieChart.update();
  barChart.update();
}

// ── History table ─────────────────────────────────────────────────────────────
function addHistoryRow(comment, sentiment) {
  const tbody = document.getElementById("history-body");

  // Remove "empty" row if present
  const emptyRow = tbody.querySelector(".empty-row");
  if (emptyRow) emptyRow.remove();

  const idx = state.history.length;
  const now  = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const preview = comment.length > 70 ? comment.slice(0, 70) + "…" : comment;
  const cls     = `badge-${sentiment}`;
  const label   = sentiment.charAt(0).toUpperCase() + sentiment.slice(1);

  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${idx + 1}</td>
    <td title="${escapeHtml(comment)}">${escapeHtml(preview)}</td>
    <td><span class="badge-small ${cls}">${label}</span></td>
    <td>${now}</td>
  `;
  tbody.insertBefore(row, tbody.firstChild);

  // Keep at most 50 rows
  while (tbody.rows.length > 50) tbody.deleteRow(tbody.rows.length - 1);

  state.history.unshift({ comment, sentiment, time: now });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ── Analyze Sentiment ─────────────────────────────────────────────────────────
async function analyzeSentiment() {
  const textarea = document.getElementById("comment-input");
  const comment  = textarea.value.trim();

  if (!comment) {
    showError("Please enter a comment before analyzing.");
    return;
  }

  setUIState("loading");

  try {
    const res = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const sentiment = data.sentiment.toLowerCase();   // "positive"|"neutral"|"negative"

    // Update state
    state.total++;
    state[sentiment] = (state[sentiment] || 0) + 1;

    // Update UI
    showResult(comment, sentiment);
    addHistoryRow(comment, sentiment);
    updateDashboard();

  } catch (err) {
    showError(
      err.message.includes("Failed to fetch")
        ? "Cannot reach the API. Make sure the backend is running on port 8000."
        : err.message
    );
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function setUIState(mode) {
  document.getElementById("result-box").classList.add("hidden");
  document.getElementById("error-box").classList.add("hidden");
  document.getElementById("loading").classList.add("hidden");

  if (mode === "loading") {
    document.getElementById("loading").classList.remove("hidden");
    document.getElementById("analyze-btn").disabled = true;
  } else {
    document.getElementById("analyze-btn").disabled = false;
  }
}

function showResult(comment, sentiment) {
  setUIState("idle");
  const box     = document.getElementById("result-box");
  const badge   = document.getElementById("sentiment-badge");
  const preview = document.getElementById("result-comment-preview");

  const emojis = { positive: "😊 Positive", neutral: "😐 Neutral", negative: "😠 Negative" };

  badge.className  = `sentiment-badge ${sentiment}`;
  badge.textContent = emojis[sentiment] || sentiment;
  preview.textContent = `"${comment.slice(0, 100)}${comment.length > 100 ? "…" : ""}"`;

  box.classList.remove("hidden");
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showError(message) {
  setUIState("idle");
  document.getElementById("error-message").textContent = message;
  document.getElementById("error-box").classList.remove("hidden");
}

function clearAll() {
  document.getElementById("comment-input").value = "";
  document.getElementById("char-count").textContent = "0";
  document.getElementById("result-box").classList.add("hidden");
  document.getElementById("error-box").classList.add("hidden");
}

function setExample(text) {
  document.getElementById("comment-input").value = text;
  document.getElementById("char-count").textContent = text.length;
  document.getElementById("result-box").classList.add("hidden");
  document.getElementById("error-box").classList.add("hidden");
}

// ── Character counter ─────────────────────────────────────────────────────────
document.getElementById("comment-input").addEventListener("input", function () {
  document.getElementById("char-count").textContent = this.value.length;
});

// Ctrl+Enter → analyze
document.getElementById("comment-input").addEventListener("keydown", function (e) {
  if (e.ctrlKey && e.key === "Enter") analyzeSentiment();
});

// ── API Health Check ──────────────────────────────────────────────────────────
async function checkHealth() {
  const dot = document.getElementById("health-dot");
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      dot.className = "health-indicator online";
      dot.title     = "API is online";
      dot.querySelector(".health-label").textContent = "Online";
    } else {
      throw new Error("Non-OK response");
    }
  } catch {
    dot.className = "health-indicator offline";
    dot.title     = "API is offline — start the server";
    dot.querySelector(".health-label").textContent = "Offline";
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  initCharts();
  checkHealth();
  setInterval(checkHealth, 15000);
});
