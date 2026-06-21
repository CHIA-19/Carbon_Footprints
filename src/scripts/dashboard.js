"use strict";
/**
 * dashboard.js
 * ============
 * Renders the progress dashboard: charts, heatmap, report card, challenges widget, goal tracking.
 * Uses Chart.js (loaded via CDN in index.html).
 */

import { EMISSION_FACTORS } from "../data/emissionFactors.js";
import { loadAllLogs, loadRecentLogs, loadGoal, saveGoal } from "./storage.js";
import { generateGoalNudge } from "./insightsEngine.js";

let weeklyChartInstance = null;
let donutChartInstance = null;

// â”€â”€â”€ MAIN RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Render the full dashboard into #dashboard-section.
 * @param {Object} profile â€” user baseline profile
 */
export function renderDashboard(profile) {
  const section = document.getElementById("dashboard-section");
  if (!section) return;

  const weekLogs = loadRecentLogs(7);
  const allLogs = loadAllLogs();
  const goal = loadGoal();

  weeklyChartInstance?.destroy();
  donutChartInstance?.destroy();

  const stats = _computeStats(weekLogs, allLogs);

  section.innerHTML = `
    <div class="dashboard-grid">

      <!-- â”€â”€ Goal nudge banner â”€â”€ -->
      ${_renderGoalBanner(weekLogs, profile, goal)}

      <!-- â”€â”€ This week at a glance â”€â”€ -->
      <div class="dash-card glass-card span-2" id="today-summary-card">
        <h3 class="dash-card-title">ðŸ“Š This Week at a Glance</h3>
        <div class="kpi-row">
          <div class="kpi-item">
            <span class="kpi-value">${stats.weekTotal.toFixed(1)}</span>
            <span class="kpi-label">kg COâ‚‚e this week</span>
          </div>
          <div class="kpi-item">
            <span class="kpi-value">${stats.dailyAvg.toFixed(1)}</span>
            <span class="kpi-label">kg COâ‚‚e daily avg</span>
          </div>
          <div class="kpi-item ${stats.vsParisClass}">
            <span class="kpi-value">${stats.vsParis}</span>
            <span class="kpi-label">vs Paris daily target (5.5 kg)</span>
          </div>
          <div class="kpi-item ${stats.streakClass}">
            <span class="kpi-value">${stats.streak}</span>
            <span class="kpi-label">${stats.streakLabel}</span>
          </div>
        </div>
        <div class="equivalences">
          <div class="equiv-item">ðŸš— â‰ˆ driving <strong>${stats.carKmEquiv.toFixed(0)} km</strong></div>
          <div class="equiv-item">ðŸŒ³ â‰ˆ <strong>${stats.treeDays.toFixed(0)} days</strong> of tree absorption</div>
          <div class="equiv-item">ðŸ“± â‰ˆ <strong>${stats.phoneCharges.toFixed(0)}</strong> smartphone charges</div>
        </div>
        <p class="methodology-note"><a href="#" id="open-methodology-link">â„¹ï¸ How we calculate this (estimates only)</a></p>
      </div>

      <!-- â”€â”€ 7/30-day bar chart â”€â”€ -->
      <div class="dash-card glass-card" id="chart-card">
        <div class="dash-card-title-row">
          <h3 class="dash-card-title">ðŸ“ˆ Daily COâ‚‚e History</h3>
          <div class="chart-period-toggle" role="group" aria-label="Chart period toggle">
            <button class="chart-period-btn active" id="chart-7d-btn" aria-pressed="true">7 days</button>
            <button class="chart-period-btn" id="chart-30d-btn" aria-pressed="false">30 days</button>
          </div>
        </div>
        ${
          weekLogs.length === 0
            ? '<p class="empty-state">Log a day to see your chart!</p>'
            : '<div class="chart-wrap"><canvas id="weekly-chart"></canvas></div>'
        }
        <div class="chart-legend">
          <span class="legend-dot" style="background:#ff6b6b"></span> Global avg (${EMISSION_FACTORS.baselines.global_avg_daily_kg} kg)
          &nbsp;&nbsp;
          <span class="legend-dot" style="background:#12d98a"></span> Paris target (${EMISSION_FACTORS.baselines.paris_target_daily_kg} kg)
        </div>
      </div>

      <!-- â”€â”€ Category donut â”€â”€ -->
      <div class="dash-card glass-card">
        <h3 class="dash-card-title">ðŸ© Breakdown by Category</h3>
        ${
          weekLogs.length === 0
            ? '<p class="empty-state">Log a day to see your breakdown!</p>'
            : `<div class="chart-wrap donut-wrap">
              <canvas id="donut-chart"></canvas>
              <div class="donut-centre">
                <span class="donut-total">${stats.weekTotal.toFixed(1)}</span>
                <span class="donut-unit">kg COâ‚‚e</span>
              </div>
            </div>`
        }
        <div class="category-bars">
          ${_renderCategoryBars(stats.categoryTotals, stats.weekTotal)}
        </div>
      </div>

      <!-- â”€â”€ Calendar heatmap â”€â”€ -->
      <div class="dash-card glass-card span-2" id="heatmap-card">
        <h3 class="dash-card-title">ðŸ—“ï¸ 12-Week Activity Heatmap</h3>
        ${_renderHeatmap(allLogs)}
      </div>

      <!-- â”€â”€ Goal setting â”€â”€ -->
      <div class="dash-card glass-card">
        <h3 class="dash-card-title">ðŸŽ¯ Weekly Reduction Goal</h3>
        <p class="goal-desc">Set a % reduction from the global average (${EMISSION_FACTORS.baselines.global_avg_daily_kg} kg/day baseline).</p>
        <div class="goal-form">
          <label for="goal-slider" class="goal-label">Reduce by <span id="goal-pct-display">${goal?.percent || 10}%</span></label>
          <input type="range" id="goal-slider" min="5" max="50" step="5" value="${goal?.percent || 10}" class="goal-slider">
          <div class="goal-target-preview" id="goal-target-preview">
            Target: â‰¤ ${_computeTargetKg(goal?.percent || 10).toFixed(1)} kg/day
          </div>
          <button class="btn-secondary" id="save-goal-btn">Save Goal</button>
        </div>
      </div>

      <!-- â”€â”€ Streak / Milestones â”€â”€ -->
      <div class="dash-card glass-card">
        <h3 class="dash-card-title">ðŸ… Milestones</h3>
        <div class="milestones-list">
          ${_renderMilestones(allLogs, stats)}
        </div>
      </div>

    </div>
  `;

  // â”€â”€ Charts â”€â”€
  if (weekLogs.length > 0) {
    _renderWeeklyChart(weekLogs);
    _renderDonutChart(stats.categoryTotals);
  }

  // â”€â”€ Goal slider â”€â”€
  const goalSlider = document.getElementById("goal-slider");
  goalSlider?.addEventListener("input", () => {
    const pct = parseInt(goalSlider.value);
    document.getElementById("goal-pct-display").textContent = `${pct}%`;
    document.getElementById("goal-target-preview").textContent =
      `Target: â‰¤ ${_computeTargetKg(pct).toFixed(1)} kg/day`;
  });
  document.getElementById("save-goal-btn")?.addEventListener("click", () => {
    const pct = parseInt(goalSlider.value);
    saveGoal(pct);
    const btn = document.getElementById("save-goal-btn");
    btn.textContent = "âœ“ Saved!";
    btn.classList.add("btn-saved");
    setTimeout(() => {
      btn.textContent = "Save Goal";
      btn.classList.remove("btn-saved");
    }, 2000);
    renderDashboard(profile);
  });

  // â”€â”€ 7d / 30d toggle â”€â”€
  document.getElementById("chart-7d-btn")?.addEventListener("click", () => {
    document.getElementById("chart-7d-btn").classList.add("active");
    document
      .getElementById("chart-7d-btn")
      .setAttribute("aria-pressed", "true");
    document.getElementById("chart-30d-btn").classList.remove("active");
    document
      .getElementById("chart-30d-btn")
      .setAttribute("aria-pressed", "false");
    weeklyChartInstance?.destroy();
    _renderWeeklyChart(loadRecentLogs(7));
  });
  document.getElementById("chart-30d-btn")?.addEventListener("click", () => {
    document.getElementById("chart-30d-btn").classList.add("active");
    document
      .getElementById("chart-30d-btn")
      .setAttribute("aria-pressed", "true");
    document.getElementById("chart-7d-btn").classList.remove("active");
    document
      .getElementById("chart-7d-btn")
      .setAttribute("aria-pressed", "false");
    weeklyChartInstance?.destroy();
    _renderWeeklyChart(loadRecentLogs(30));
  });

  // â”€â”€ Methodology link â”€â”€
  document
    .getElementById("open-methodology-link")
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      window.showMethodologyModal?.();
    });
}

// â”€â”€â”€ CHART RENDERERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Renders the weekly bar chart showing daily COâ‚‚e history.
 * @param {Array} logs - Array of daily log objects
 */
function _renderWeeklyChart(logs) {
  const ctx = document.getElementById("weekly-chart")?.getContext("2d");
  if (!ctx || logs.length === 0) return;

  const labels = logs.map((l) => {
    const d = new Date(l.date + "T12:00:00");
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  });
  const data = logs.map((l) => l.totals?.total || 0);

  weeklyChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Daily COâ‚‚e (kg)",
          data,
          backgroundColor: data.map((v) =>
            v > EMISSION_FACTORS.baselines.global_avg_daily_kg
              ? "rgba(255,107,107,0.7)"
              : v > EMISSION_FACTORS.baselines.paris_target_daily_kg
                ? "rgba(255,193,7,0.7)"
                : "rgba(18,217,138,0.7)",
          ),
          borderColor: data.map((v) =>
            v > EMISSION_FACTORS.baselines.global_avg_daily_kg
              ? "#ff6b6b"
              : v > EMISSION_FACTORS.baselines.paris_target_daily_kg
                ? "#ffc107"
                : "#12d98a",
          ),
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (c) => `~ ${c.parsed.y.toFixed(1)} kg COâ‚‚e` },
        },
        annotation: {
          annotations: {
            parisLine: {
              type: "line",
              yMin: EMISSION_FACTORS.baselines.paris_target_daily_kg,
              yMax: EMISSION_FACTORS.baselines.paris_target_daily_kg,
              borderColor: "#12d98a",
              borderWidth: 1,
              borderDash: [6, 4],
            },
            globalLine: {
              type: "line",
              yMin: EMISSION_FACTORS.baselines.global_avg_daily_kg,
              yMax: EMISSION_FACTORS.baselines.global_avg_daily_kg,
              borderColor: "#ff6b6b",
              borderWidth: 1,
              borderDash: [6, 4],
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,0.07)" },
          ticks: { color: "#a0aec0", callback: (v) => `${v} kg` },
        },
        x: {
          grid: { display: false },
          ticks: { color: "#a0aec0", maxRotation: 45 },
        },
      },
    },
  });
}

/**
 * Renders the donut chart showing the breakdown of emissions by category.
 * @param {Object} categoryTotals - Object containing transport, food, energy, consumption totals
 */
function _renderDonutChart(categoryTotals) {
  const ctx = document.getElementById("donut-chart")?.getContext("2d");
  if (!ctx) return;
  const data = [
    categoryTotals.transport,
    categoryTotals.food,
    categoryTotals.energy,
    categoryTotals.consumption,
  ];
  const colors = ["#4ecdc4", "#ffd93d", "#ff6b6b", "#a78bfa"];
  donutChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Transport", "Food", "Energy", "Shopping"],
      datasets: [
        {
          data,
          backgroundColor: colors.map((c) => c + "cc"),
          borderColor: colors,
          borderWidth: 2,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => `${c.label}: ~ ${c.parsed.toFixed(1)} kg COâ‚‚e`,
          },
        },
      },
    },
  });
}

// â”€â”€â”€ HEATMAP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Renders a 12-week GitHub-style activity heatmap of daily emissions.
 * @param {Array} allLogs - Array of all historical daily log objects
 * @returns {string} HTML string for the heatmap component
 */
function _renderHeatmap(allLogs) {
  const today = new Date();
  const logMap = {};
  for (const l of allLogs) logMap[l.date] = l;

  const paris = EMISSION_FACTORS.baselines.paris_target_daily_kg;
  const global = EMISSION_FACTORS.baselines.global_avg_daily_kg;

  // Build 84 cells (12 weeks Ã— 7 days), ending today
  const cells = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    cells.push({ dateStr, log: logMap[dateStr] || null });
  }

  // Group into 12 columns of 7
  const weeks = [];
  for (let w = 0; w < 12; w++) weeks.push(cells.slice(w * 7, (w + 1) * 7));

  function cellColor(log) {
    if (!log) return "rgba(255,255,255,0.06)";
    const v = log.totals?.total || 0;
    if (v <= paris) return "rgba(18,217,138,0.82)";
    if (v <= global) return "rgba(255,193,7,0.82)";
    return "rgba(255,107,107,0.82)";
  }

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return `
    <div class="heatmap-wrap">
      <div class="heatmap-inner">
        <div class="heatmap-day-labels" aria-hidden="true">
          ${dayLabels.map((d) => `<span>${d}</span>`).join("")}
        </div>
        <div class="heatmap-grid" role="img" aria-label="12-week activity heatmap showing daily emissions">
          ${weeks
            .map(
              (week) => `
            <div class="heatmap-col">
              ${week
                .map(
                  (cell) => `
                <div class="heatmap-cell"
                     style="background:${cellColor(cell.log)}"
                     title="${cell.dateStr}${cell.log ? ": ~" + (cell.log.totals?.total || 0).toFixed(1) + " kg COâ‚‚e" + (cell.log.note ? " Â· " + cell.log.note : "") : " (no log)"}"
                     aria-label="${cell.dateStr}${cell.log ? ": ~" + (cell.log.totals?.total || 0).toFixed(1) + " kg COâ‚‚e" + (cell.log.note ? " Â· " + cell.log.note : "") : " (no log)"}">
                </div>
              `,
                )
                .join("")}
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
      <div class="heatmap-legend">
        <span class="heatmap-leg"><span class="heatmap-leg-dot" style="background:rgba(18,217,138,0.82)"></span>â‰¤ Paris (5.5 kg)</span>
        <span class="heatmap-leg"><span class="heatmap-leg-dot" style="background:rgba(255,193,7,0.82)"></span>Below global avg</span>
        <span class="heatmap-leg"><span class="heatmap-leg-dot" style="background:rgba(255,107,107,0.82)"></span>Above global avg</span>
        <span class="heatmap-leg"><span class="heatmap-leg-dot" style="background:rgba(255,255,255,0.08)"></span>Not logged</span>
      </div>
      <p class="heatmap-tip">ðŸ’¡ Hover over a cell to see the date and your emissions</p>
    </div>
  `;
}

// â”€â”€â”€ STATS COMPUTATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Computes weekly aggregate statistics, daily averages, and equivalents.
 * @param {Array} weekLogs - Logs from the current week
 * @param {Array} allLogs - All historical logs (for streak calculation)
 * @returns {Object} Computed statistics object
 */
function _computeStats(weekLogs, allLogs) {
  const cats = ["transport", "food", "energy", "consumption"];
  const categoryTotals = { transport: 0, food: 0, energy: 0, consumption: 0 };
  let weekTotal = 0;
  for (const log of weekLogs) {
    weekTotal += log.totals?.total || 0;
    for (const cat of cats) categoryTotals[cat] += log.totals?.[cat] || 0;
  }
  const n = weekLogs.length || 1;
  const dailyAvg = weekTotal / n;
  const parisDailyBudget = EMISSION_FACTORS.baselines.paris_target_daily_kg;
  const globalDaily = EMISSION_FACTORS.baselines.global_avg_daily_kg;
  const vsParisDiff = dailyAvg - parisDailyBudget;
  const vsParis =
    vsParisDiff > 0
      ? `+${vsParisDiff.toFixed(1)} kg`
      : `${vsParisDiff.toFixed(1)} kg`;
  const vsParisClass = vsParisDiff > 0 ? "kpi-item--bad" : "kpi-item--good";
  const carKmEquiv = weekTotal * EMISSION_FACTORS.baselines.car_km_per_kg_co2;
  const treeDays =
    (weekTotal / EMISSION_FACTORS.baselines.tree_offset_kg_year) * 365;
  const phoneCharges =
    weekTotal * EMISSION_FACTORS.baselines.smartphone_charges_per_kg;
  const streak = _computeStreak(allLogs, dailyAvg > 0 ? dailyAvg : globalDaily);
  return {
    weekTotal,
    dailyAvg,
    categoryTotals,
    vsParis,
    vsParisClass,
    carKmEquiv,
    treeDays,
    phoneCharges,
    streak: streak.count,
    streakLabel: streak.label,
    streakClass: streak.count > 0 ? "kpi-item--good" : "",
  };
}

/**
 * Calculates the consecutive number of days the user has been under their benchmark.
 * @param {Array} allLogs - All historical logs
 * @param {number} benchmark - The daily target or average to beat
 * @returns {Object} Object containing count and label
 */
function _computeStreak(allLogs, benchmark) {
  if (allLogs.length === 0) return { count: 0, label: "days logged" };
  let streak = 0;
  const sorted = [...allLogs].reverse();
  for (const log of sorted) {
    if ((log.totals?.total || 0) <= benchmark) streak++;
    else break;
  }
  if (streak === 0)
    return { count: allLogs.length, label: "days logged total" };
  return {
    count: streak,
    label:
      streak === 1 ? "day under your average" : "days under your average ðŸ”¥",
  };
}

// â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * @description Internal function
 * @internal
 */
function _renderGoalBanner(weekLogs, profile, goal) {
  if (!goal || weekLogs.length === 0) {
    return `<div class="goal-banner glass-card span-full">
      <span class="goal-banner-icon">ðŸŽ¯</span>
      <span>Set a weekly goal below to track your progress here.</span>
    </div>`;
  }
  const nudge = generateGoalNudge(weekLogs, profile, goal);
  if (!nudge) return "";
  return `
    <div class="goal-banner glass-card span-full ${nudge.onTrack ? "goal-banner--good" : "goal-banner--warn"}">
      <span class="goal-banner-icon">${nudge.onTrack ? "âœ…" : "ðŸ“Š"}</span>
      <div>
        <p>${nudge.sentence}</p>
        ${nudge.leverTip ? `<p class="goal-lever-tip">ðŸ’¡ <em>${nudge.leverTip}</em></p>` : ""}
      </div>
    </div>
  `;
}

/**
 * @description Internal function
 * @internal
 */
function _renderCategoryBars(totals, weekTotal) {
  const cats = [
    { key: "transport", label: "ðŸš— Transport", color: "#4ecdc4" },
    { key: "food", label: "ðŸ½ï¸ Food", color: "#ffd93d" },
    { key: "energy", label: "âš¡ Energy", color: "#ff6b6b" },
    { key: "consumption", label: "ðŸ›ï¸ Shopping", color: "#a78bfa" },
  ];
  if (weekTotal === 0) return '<p class="empty-state">No data yet</p>';
  return cats
    .map((cat) => {
      const pct =
        weekTotal > 0 ? ((totals[cat.key] / weekTotal) * 100).toFixed(0) : 0;
      return `<div class="cat-bar-row">
      <span class="cat-bar-label">${cat.label}</span>
      <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%;background:${cat.color}"></div></div>
      <span class="cat-bar-value">${totals[cat.key].toFixed(1)} kg</span>
    </div>`;
    })
    .join("");
}

/**
 * @description Internal function
 * @internal
 */
function _renderMilestones(allLogs, stats) {
  const milestones = [];
  if (allLogs.length >= 1)
    milestones.push({
      icon: "ðŸ“…",
      text: "First log recorded â€” you started your journey!",
    });
  if (allLogs.length >= 7)
    milestones.push({
      icon: "ðŸ—“ï¸",
      text: "7 days logged â€” you're building a habit.",
    });
  if (allLogs.length >= 30)
    milestones.push({
      icon: "ðŸ“†",
      text: "30 days logged â€” you're a carbon-conscious pro.",
    });
  if (stats.streak >= 3)
    milestones.push({
      icon: "ðŸ”¥",
      text: `${stats.streak} days under your daily average in a row!`,
    });
  if (stats.weekTotal < EMISSION_FACTORS.baselines.paris_target_daily_kg * 7) {
    milestones.push({
      icon: "ðŸŒ",
      text: "This week was under the Paris 1.5Â°C weekly budget. Outstanding!",
    });
  }
  if (milestones.length === 0)
    return '<p class="empty-state">Log a few days to unlock milestones!</p>';
  return milestones
    .map(
      (m) =>
        `<div class="milestone-item"><span class="milestone-icon">${m.icon}</span><span class="milestone-text">${m.text}</span></div>`,
    )
    .join("");
}

/**
 * @description Internal function
 * @internal
 */
function _computeTargetKg(percent) {
  return EMISSION_FACTORS.baselines.global_avg_daily_kg * (1 - percent / 100);
}
