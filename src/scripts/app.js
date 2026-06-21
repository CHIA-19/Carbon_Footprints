/**
 * app.js
 * ======
 * Main application entry point.
 * Orchestrates: onboarding → logger → insights → dashboard.
 * Handles navigation between sections and global UI state.
 */

import { hasCompletedOnboarding, loadProfile, loadRecentLogs, loadTodayLog, loadAllLogs, clearAllData } from './storage.js';
import { renderOnboarding } from './onboarding.js';
import { renderActivityLogger } from './activityLogger.js';
import { renderDashboard } from './dashboard.js';
import { generateInsight } from './insightsEngine.js';
import { renderSimulator } from './simulator.js';
import { renderChallenges } from './challenges.js';

// Module-level profile cache (enables lazy rendering in navigateTo)
let _profile = null;

// ─────────────────────────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // Register global modal helper
  window.showMethodologyModal = showMethodologyModal;

  // Wire nav
  initNavigation();

  // Wire reset button
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    if (confirm('This will clear all your local data. Are you sure?')) {
      clearAllData();
      location.reload();
    }
  });

  // Wire export button
  document.getElementById('export-btn')?.addEventListener('click', _exportCSV);

  // Check onboarding
  if (!hasCompletedOnboarding()) {
    renderOnboarding((profile) => {
      onProfileReady(profile);
    });
  } else {
    const profile = loadProfile();
    onProfileReady(profile);
  }
}

function onProfileReady(profile) {
  _profile = profile; // cache for lazy renderers

  // Update greeting
  const greet = document.getElementById('hero-greeting');
  if (greet && profile?.name) {
    greet.textContent = `Welcome back, ${profile.name}!`;
  } else if (greet) {
    greet.textContent = `Your daily carbon tracker`;
  }

  // Render logger (home view)
  renderActivityLogger(profile, (log) => {
    onDayLogged(log, profile);
  });

  // Render dashboard
  renderDashboard(profile);

  // If already logged today, show insights
  const todayLog = loadTodayLog();
  if (todayLog) {
    const weekLogs = loadRecentLogs(7);
    const insight = generateInsight(todayLog, weekLogs, profile);
    renderInsight(insight);
  }

  // Show today's badge in nav
  updateNavBadge();

  // Animate on-load
  document.body.classList.add('app-ready');
}

// ─────────────────────────────────────────────────────────────────
// AFTER LOG SUBMITTED
// ─────────────────────────────────────────────────────────────────

function onDayLogged(log, profile) {
  // Generate insight
  const weekLogs = loadRecentLogs(7);
  const insight  = generateInsight(log, weekLogs, profile);
  renderInsight(insight);

  // Re-render dashboard with new data
  renderDashboard(profile);

  // Navigate to insights view
  navigateTo('insights');
  updateNavBadge();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─────────────────────────────────────────────────────────────────
// INSIGHT RENDERING
// ─────────────────────────────────────────────────────────────────

function renderInsight(insight) {
  const section = document.getElementById('insights-section');
  if (!section) return;

  // Hide empty state when a real insight is available
  const emptyState = document.getElementById('insights-empty-state');
  if (emptyState) emptyState.classList.add('hidden');

  const catColors = {
    transport:   { color: '#4ecdc4', icon: '🚗' },
    food:        { color: '#ffd93d', icon: '🍽️' },
    energy:      { color: '#ff6b6b', icon: '⚡' },
    consumption: { color: '#a78bfa', icon: '🛍️' },
    null:        { color: '#12d98a', icon: '🌿' },
  };
  const meta = catColors[insight.category] || catColors['null'];

  section.innerHTML = `
    <div class="insight-card glass-card ${insight.isPositive ? 'insight-positive' : ''}">
      <div class="insight-header">
        <span class="insight-cat-icon">${meta.icon}</span>
        <div>
          <span class="insight-badge" style="color:${meta.color}">
            ${insight.isPositive ? 'Great work today!' : 'Today\'s insight'}
          </span>
          <h2 class="insight-headline">
            ${insight.isPositive ? "You're doing great 🌍" : "Here's what stood out today"}
          </h2>
        </div>
      </div>

      <div class="insight-body">
        <div class="insight-context-box" style="border-left-color:${meta.color}">
          <p class="insight-context-text">${insight.contextSentence}</p>
        </div>

        <div class="insight-tip-box ${insight.isPositive ? 'tip-box-positive' : 'tip-box-action'}">
          <span class="tip-icon">💡</span>
          <p class="insight-tip-text">${insight.tipText}</p>
        </div>
      </div>

      <div class="insight-actions">
        <button class="btn-secondary" id="log-another-btn">📝 Log another day</button>
        <button class="btn-ghost"    id="view-dashboard-btn">📊 See full dashboard</button>
      </div>
    </div>
  `;

  document.getElementById('log-another-btn')?.addEventListener('click', () => navigateTo('logger'));
  document.getElementById('view-dashboard-btn')?.addEventListener('click', () => navigateTo('dashboard'));
}

// ─────────────────────────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────────────────────────

function initNavigation() {
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.nav));
  });
}

function navigateTo(view) {
  // Hide all views
  document.querySelectorAll('.app-view').forEach(v => v.classList.add('hidden'));
  // Show target view
  const target = document.getElementById(`view-${view}`);
  target?.classList.remove('hidden');

  // Update nav active state
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.classList.toggle('nav-active', btn.dataset.nav === view);
  });

  // Lazy-render new views on each visit (they need fresh log data)
  if (view === 'simulator')  renderSimulator(_profile);
  if (view === 'challenges') renderChallenges();
}

function updateNavBadge() {
  const badge = document.getElementById('logger-nav-badge');
  const todayLog = loadTodayLog();
  if (badge) {
    badge.classList.toggle('badge-done', Boolean(todayLog));
    badge.textContent = todayLog ? '✓' : '•';
  }
}

// ─────────────────────────────────────────────────────────────────
// METHODOLOGY MODAL
// ─────────────────────────────────────────────────────────────────

function showMethodologyModal() {
  const modal = document.getElementById('methodology-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  // Use { once: true } to avoid stacking duplicate listeners on repeated opens
  document.getElementById('modal-close')?.addEventListener('click', () => {
    modal.classList.add('hidden');
  }, { once: true });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  }, { once: true });
}

// ─────────────────────────────────────────────────────────────────
// DATA EXPORT (CSV)
// ─────────────────────────────────────────────────────────────────

function _exportCSV() {
  const logs = loadAllLogs();
  if (logs.length === 0) { alert('No data to export yet — log a day first!'); return; }
  const header = 'Date,Transport(kg),Food(kg),Energy(kg),Shopping(kg),Total(kg),Note\n';
  const rows = logs.map(l =>
    `${l.date},${(l.totals?.transport||0).toFixed(3)},${(l.totals?.food||0).toFixed(3)},` +
    `${(l.totals?.energy||0).toFixed(3)},${(l.totals?.consumption||0).toFixed(3)},` +
    `${(l.totals?.total||0).toFixed(3)},"${(l.note||'').replace(/"/g, '""')}"`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href  = url;
  link.download = `carbonlite-export-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
