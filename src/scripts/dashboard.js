/**
 * dashboard.js
 * ============
 * Renders the progress dashboard: charts, comparisons, streaks, and goal tracking.
 * Uses Chart.js (loaded via CDN in index.html).
 */

import { EMISSION_FACTORS } from '../data/emissionFactors.js';
import { loadAllLogs, loadRecentLogs, loadGoal, saveGoal } from './storage.js';
import { generateGoalNudge } from './insightsEngine.js';

let weeklyChartInstance = null;
let donutChartInstance  = null;

// ─────────────────────────────────────────────────────────────────
// MAIN RENDER
// ─────────────────────────────────────────────────────────────────

/**
 * Render the full dashboard into #dashboard-section.
 * @param {Object} profile — user baseline profile
 */
export function renderDashboard(profile) {
  const section = document.getElementById('dashboard-section');
  if (!section) return;

  const weekLogs = loadRecentLogs(7);
  const allLogs  = loadAllLogs();
  const goal     = loadGoal();

  // Destroy existing chart instances to prevent memory leaks on re-render
  weeklyChartInstance?.destroy();
  donutChartInstance?.destroy();

  const stats = _computeStats(weekLogs, allLogs);

  section.innerHTML = `
    <div class="dashboard-grid">

      <!-- ── Goal nudge banner ── -->
      ${_renderGoalBanner(weekLogs, profile, goal)}

      <!-- ── Today's summary card ── -->
      <div class="dash-card glass-card span-2" id="today-summary-card">
        <h3 class="dash-card-title">📊 This Week at a Glance</h3>
        <div class="kpi-row">
          <div class="kpi-item">
            <span class="kpi-value">${stats.weekTotal.toFixed(1)}</span>
            <span class="kpi-label">kg CO₂e this week</span>
          </div>
          <div class="kpi-item">
            <span class="kpi-value">${stats.dailyAvg.toFixed(1)}</span>
            <span class="kpi-label">kg CO₂e daily avg</span>
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
        <!-- Equivalences -->
        <div class="equivalences">
          <div class="equiv-item">🚗 ≈ driving <strong>${stats.carKmEquiv.toFixed(0)} km</strong></div>
          <div class="equiv-item">🌳 ≈ <strong>${stats.treeDays.toFixed(0)} days</strong> of tree absorption</div>
          <div class="equiv-item">📱 ≈ <strong>${stats.phoneCharges.toFixed(0)}</strong> smartphone charges</div>
        </div>
        <p class="methodology-note"><a href="#" id="open-methodology-link">ℹ️ How we calculate this (estimates only)</a></p>
      </div>

      <!-- ── 7-day line chart ── -->
      <div class="dash-card glass-card">
        <h3 class="dash-card-title">📈 Daily CO₂e — Last 7 Days</h3>
        ${weekLogs.length === 0
          ? '<p class="empty-state">Log a day to see your chart!</p>'
          : '<div class="chart-wrap"><canvas id="weekly-chart"></canvas></div>'
        }
        <div class="chart-legend">
          <span class="legend-dot" style="background:#ff6b6b"></span> Global avg (${EMISSION_FACTORS.baselines.global_avg_daily_kg} kg)
          &nbsp;&nbsp;
          <span class="legend-dot" style="background:#12d98a"></span> Paris target (${EMISSION_FACTORS.baselines.paris_target_daily_kg} kg)
        </div>
      </div>

      <!-- ── Category donut ── -->
      <div class="dash-card glass-card">
        <h3 class="dash-card-title">🍩 Breakdown by Category</h3>
        ${weekLogs.length === 0
          ? '<p class="empty-state">Log a day to see your breakdown!</p>'
          : `<div class="chart-wrap donut-wrap">
              <canvas id="donut-chart"></canvas>
              <div class="donut-centre">
                <span class="donut-total">${stats.weekTotal.toFixed(1)}</span>
                <span class="donut-unit">kg CO₂e</span>
              </div>
            </div>`
        }
        <div class="category-bars">
          ${_renderCategoryBars(stats.categoryTotals, stats.weekTotal)}
        </div>
      </div>

      <!-- ── Goal setting ── -->
      <div class="dash-card glass-card">
        <h3 class="dash-card-title">🎯 Weekly Reduction Goal</h3>
        <p class="goal-desc">Set a % reduction from the global average (${EMISSION_FACTORS.baselines.global_avg_daily_kg} kg/day baseline).</p>
        <div class="goal-form">
          <label for="goal-slider" class="goal-label">Reduce by <span id="goal-pct-display">${goal?.percent || 10}%</span></label>
          <input type="range" id="goal-slider" min="5" max="50" step="5" value="${goal?.percent || 10}" class="goal-slider">
          <div class="goal-target-preview" id="goal-target-preview">
            Target: ≤ ${_computeTargetKg(goal?.percent || 10).toFixed(1)} kg/day
          </div>
          <button class="btn-secondary" id="save-goal-btn">Save Goal</button>
        </div>
      </div>

      <!-- ── Streak / Milestones ── -->
      <div class="dash-card glass-card">
        <h3 class="dash-card-title">🏅 Milestones</h3>
        <div class="milestones-list">
          ${_renderMilestones(allLogs, stats)}
        </div>
      </div>

    </div>
  `;

  // Wire up charts after DOM insertion
  if (weekLogs.length > 0) {
    _renderWeeklyChart(weekLogs);
    _renderDonutChart(stats.categoryTotals);
  }

  // Goal slider
  const goalSlider = document.getElementById('goal-slider');
  goalSlider?.addEventListener('input', () => {
    const pct = parseInt(goalSlider.value);
    document.getElementById('goal-pct-display').textContent = `${pct}%`;
    document.getElementById('goal-target-preview').textContent = `Target: ≤ ${_computeTargetKg(pct).toFixed(1)} kg/day`;
  });
  document.getElementById('save-goal-btn')?.addEventListener('click', () => {
    const pct = parseInt(goalSlider.value);
    saveGoal(pct);
    const btn = document.getElementById('save-goal-btn');
    btn.textContent = '✓ Saved!';
    btn.classList.add('btn-saved');
    setTimeout(() => { btn.textContent = 'Save Goal'; btn.classList.remove('btn-saved'); }, 2000);
    // Re-render nudge banner
    renderDashboard(profile);
  });

  // Methodology link
  document.getElementById('open-methodology-link')?.addEventListener('click', e => {
    e.preventDefault();
    window.showMethodologyModal?.();
  });
}

// ─────────────────────────────────────────────────────────────────
// CHART RENDERERS
// ─────────────────────────────────────────────────────────────────

function _renderWeeklyChart(weekLogs) {
  const ctx = document.getElementById('weekly-chart')?.getContext('2d');
  if (!ctx) return;

  const labels = weekLogs.map(l => {
    const d = new Date(l.date + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
  });
  const data = weekLogs.map(l => l.totals?.total || 0);

  weeklyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Daily CO₂e (kg)',
          data,
          backgroundColor: data.map(v =>
            v > EMISSION_FACTORS.baselines.global_avg_daily_kg ? 'rgba(255,107,107,0.7)'
            : v > EMISSION_FACTORS.baselines.paris_target_daily_kg ? 'rgba(255,193,7,0.7)'
            : 'rgba(18,217,138,0.7)'
          ),
          borderColor: data.map(v =>
            v > EMISSION_FACTORS.baselines.global_avg_daily_kg ? '#ff6b6b'
            : v > EMISSION_FACTORS.baselines.paris_target_daily_kg ? '#ffc107'
            : '#12d98a'
          ),
          borderWidth: 1,
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `~ ${ctx.parsed.y.toFixed(1)} kg CO₂e`,
          }
        },
        annotation: {
          annotations: {
            parisLine: {
              type: 'line',
              yMin: EMISSION_FACTORS.baselines.paris_target_daily_kg,
              yMax: EMISSION_FACTORS.baselines.paris_target_daily_kg,
              borderColor: '#12d98a',
              borderWidth: 1,
              borderDash: [6, 4],
            },
            globalLine: {
              type: 'line',
              yMin: EMISSION_FACTORS.baselines.global_avg_daily_kg,
              yMax: EMISSION_FACTORS.baselines.global_avg_daily_kg,
              borderColor: '#ff6b6b',
              borderWidth: 1,
              borderDash: [6, 4],
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.07)' },
          ticks: { color: '#a0aec0', callback: v => `${v} kg` },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#a0aec0' },
        }
      }
    }
  });
}

function _renderDonutChart(categoryTotals) {
  const ctx = document.getElementById('donut-chart')?.getContext('2d');
  if (!ctx) return;

  const labels = ['Transport', 'Food', 'Energy', 'Shopping'];
  const data   = [categoryTotals.transport, categoryTotals.food, categoryTotals.energy, categoryTotals.consumption];
  const colors = ['#4ecdc4', '#ffd93d', '#ff6b6b', '#a78bfa'];

  donutChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor: colors,
        borderWidth: 2,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ~ ${ctx.parsed.toFixed(1)} kg CO₂e`,
          }
        }
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// STATS COMPUTATION
// ─────────────────────────────────────────────────────────────────

function _computeStats(weekLogs, allLogs) {
  const cats = ['transport', 'food', 'energy', 'consumption'];
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

  // vs Paris
  const vsParisDiff = dailyAvg - parisDailyBudget;
  const vsParis = vsParisDiff > 0
    ? `+${vsParisDiff.toFixed(1)} kg`
    : `${vsParisDiff.toFixed(1)} kg`;
  const vsParisClass = vsParisDiff > 0 ? 'kpi-item--bad' : 'kpi-item--good';

  // Equivalences (weekly total)
  const carKmEquiv    = weekTotal * EMISSION_FACTORS.baselines.car_km_per_kg_co2;
  const treeDays      = (weekTotal / EMISSION_FACTORS.baselines.tree_offset_kg_year) * 365;
  const phoneCharges  = weekTotal * EMISSION_FACTORS.baselines.smartphone_charges_per_kg;

  // Streak: consecutive days logged that are below daily average
  const streak = _computeStreak(allLogs, dailyAvg > 0 ? dailyAvg : globalDaily);

  return {
    weekTotal, dailyAvg, categoryTotals, vsParis, vsParisClass,
    carKmEquiv, treeDays, phoneCharges,
    streak: streak.count,
    streakLabel: streak.label,
    streakClass: streak.count > 0 ? 'kpi-item--good' : '',
  };
}

function _computeStreak(allLogs, benchmark) {
  if (allLogs.length === 0) return { count: 0, label: 'days logged' };

  let streak = 0;
  const sorted = [...allLogs].reverse(); // newest first
  for (const log of sorted) {
    if ((log.totals?.total || 0) <= benchmark) streak++;
    else break;
  }

  if (streak === 0) {
    // Find best single day
    const best = allLogs.reduce((b, l) => (l.totals?.total || 0) < (b.totals?.total || Infinity) ? l : b, allLogs[0]);
    return { count: best ? 1 : 0, label: 'days logged total' };
  }

  return {
    count: streak,
    label: streak === 1 ? 'day under your average' : 'days under your average 🔥',
  };
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function _renderGoalBanner(weekLogs, profile, goal) {
  if (!goal || weekLogs.length === 0) {
    return `<div class="goal-banner glass-card span-full">
      <span class="goal-banner-icon">🎯</span>
      <span>Set a weekly goal below to track your progress here.</span>
    </div>`;
  }
  const nudge = generateGoalNudge(weekLogs, profile, goal);
  if (!nudge) return '';
  return `
    <div class="goal-banner glass-card span-full ${nudge.onTrack ? 'goal-banner--good' : 'goal-banner--warn'}">
      <span class="goal-banner-icon">${nudge.onTrack ? '✅' : '📊'}</span>
      <div>
        <p>${nudge.sentence}</p>
        ${nudge.leverTip ? `<p class="goal-lever-tip">💡 <em>${nudge.leverTip}</em></p>` : ''}
      </div>
    </div>
  `;
}

function _renderCategoryBars(totals, weekTotal) {
  const cats = [
    { key: 'transport',   label: '🚗 Transport', color: '#4ecdc4' },
    { key: 'food',        label: '🍽️ Food',       color: '#ffd93d' },
    { key: 'energy',      label: '⚡ Energy',      color: '#ff6b6b' },
    { key: 'consumption', label: '🛍️ Shopping',    color: '#a78bfa' },
  ];
  if (weekTotal === 0) return '<p class="empty-state">No data yet</p>';
  return cats.map(cat => {
    const pct = weekTotal > 0 ? ((totals[cat.key] / weekTotal) * 100).toFixed(0) : 0;
    return `
      <div class="cat-bar-row">
        <span class="cat-bar-label">${cat.label}</span>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${pct}%;background:${cat.color}"></div>
        </div>
        <span class="cat-bar-value">${totals[cat.key].toFixed(1)} kg</span>
      </div>
    `;
  }).join('');
}

function _renderMilestones(allLogs, stats) {
  const milestones = [];
  if (allLogs.length >= 1) milestones.push({ icon: '📅', text: `First log recorded — you started your journey!` });
  if (allLogs.length >= 7) milestones.push({ icon: '🗓️', text: `7 days logged — you\'re building a habit.` });
  if (allLogs.length >= 30) milestones.push({ icon: '📆', text: `30 days logged — you\'re a carbon-conscious pro.` });
  if (stats.streak >= 3) milestones.push({ icon: '🔥', text: `${stats.streak} days under your daily average in a row!` });
  if (stats.weekTotal < EMISSION_FACTORS.baselines.paris_target_daily_kg * 7) {
    milestones.push({ icon: '🌍', text: 'This week was under the Paris 1.5°C weekly budget. Outstanding!' });
  }

  if (milestones.length === 0) {
    return '<p class="empty-state">Log a few days to unlock milestones!</p>';
  }
  return milestones.map(m => `
    <div class="milestone-item">
      <span class="milestone-icon">${m.icon}</span>
      <span class="milestone-text">${m.text}</span>
    </div>
  `).join('');
}

function _computeTargetKg(percent) {
  return EMISSION_FACTORS.baselines.global_avg_daily_kg * (1 - percent / 100);
}
