/**
 * challenges.js
 * =============
 * Weekly challenge mode — one rotating challenge per ISO week.
 * Tracks daily progress using existing daily log data (no extra storage needed).
 */

import { loadRecentLogs } from './storage.js';

// ─── Challenge bank ───────────────────────────────────────────────────────────

const CHALLENGES = [
  {
    id: 'CAR_FREE',
    icon: '🚗',
    name: 'Car-Free Week',
    category: 'transport',
    color: '#4ecdc4',
    desc: 'Avoid cars, motorbikes, and rideshares for 5 out of 7 days this week.',
    target: 5,
    unit: 'car-free days',
    savingNote: 'A car-free day saves 2–4 kg CO₂e depending on your usual commute.',
    reward: '🌿 Zero-Wheels Badge',
    /** @param {Object|null} log */
    checkDay(log) {
      if (!log) return null;
      const mode = log.transport?.mode || '';
      const km   = log.transport?.distanceKm || 0;
      return !(['car', 'motorbike', 'rideshare'].includes(mode) && km > 0);
    },
  },
  {
    id: 'PLANT_WEEK',
    icon: '🥦',
    name: 'Plant-Based Week',
    category: 'food',
    color: '#12d98a',
    desc: 'Eat only vegetarian or vegan meals for 5 out of 7 days this week.',
    target: 5,
    unit: 'plant-based days',
    savingNote: 'Replacing all meat saves ~5.3 kg CO₂e per day on average.',
    reward: '🌱 Green Plate Badge',
    checkDay(log) {
      if (!log) return null;
      return ((log.food?.meatMeals || 0) + (log.food?.poultryMeals || 0)) === 0;
    },
  },
  {
    id: 'ENERGY_SAVER',
    icon: '⚡',
    name: 'Energy Saver',
    category: 'energy',
    color: '#ffd93d',
    desc: 'Keep AC/heating under 3 hours per day for 5 out of 7 days.',
    target: 5,
    unit: 'low-energy days',
    savingNote: 'Each hour of AC skipped saves ~0.65 kg CO₂e (1.5 kW unit on grid avg).',
    reward: '💡 Watt Watcher Badge',
    checkDay(log) {
      if (!log) return null;
      return (log.energy?.acHours || 0) <= 3;
    },
  },
  {
    id: 'NO_BUY',
    icon: '🛍️',
    name: 'No-Buy Week',
    category: 'consumption',
    color: '#a78bfa',
    desc: 'Zero online orders and zero new purchases for 5 out of 7 days.',
    target: 5,
    unit: 'no-buy days',
    savingNote: 'A no-buy week can prevent 10–60 kg CO₂e depending on your usual habits.',
    reward: '🏅 Mindful Consumer Badge',
    checkDay(log) {
      if (!log) return null;
      return (
        (log.consumption?.parcels         || 0) +
        (log.consumption?.clothingItems    || 0) +
        (log.consumption?.electronicsSmall || 0)
      ) === 0;
    },
  },
  {
    id: 'COOK_HOME',
    icon: '🍳',
    name: 'Cook At Home',
    category: 'food',
    color: '#ff9f43',
    desc: 'Avoid food delivery orders for 5 out of 7 days this week.',
    target: 5,
    unit: 'home-cooked days',
    savingNote: 'Each skipped delivery avoids ~0.7 kg CO₂e in packaging + last-mile transport.',
    reward: '👨‍🍳 Home Chef Badge',
    checkDay(log) {
      if (!log) return null;
      return (log.food?.deliveryOrders || 0) === 0;
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _getActiveChallengeIndex() {
  const ref    = new Date('2024-01-01T00:00:00Z');
  const now    = new Date();
  const weeks  = Math.floor((now - ref) / (7 * 24 * 60 * 60 * 1000));
  return weeks % CHALLENGES.length;
}

function _getWeekDates() {
  // Returns ISO date strings Mon–Sun for the current calendar week
  const today  = new Date();
  const dow    = today.getDay();                // 0 = Sunday
  const offset = dow === 0 ? -6 : 1 - dow;    // shift to Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset + i);
    return d.toISOString().slice(0, 10);
  });
}

// ─── Main render ──────────────────────────────────────────────────────────────

export function renderChallenges() {
  const section = document.getElementById('challenges-section');
  if (!section) return;

  const challenge  = CHALLENGES[_getActiveChallengeIndex()];
  const weekDates  = _getWeekDates();
  const recentLogs = loadRecentLogs(7);
  const logMap     = {};
  for (const l of recentLogs) logMap[l.date] = l;

  const today    = new Date().toISOString().slice(0, 10);
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  let passCount = 0;
  const dayResults = weekDates.map((dateStr, i) => {
    const log    = logMap[dateStr] || null;
    const result = challenge.checkDay(log);
    const isPast = dateStr <= today;
    const isToday= dateStr === today;
    if (result === true) passCount++;
    return { dateStr, dayName: dayNames[i], log, result, isPast, isToday };
  });

  const completed = passCount >= challenge.target;
  const pct       = Math.min(100, Math.round((passCount / challenge.target) * 100));

  section.innerHTML = `
    <div class="challenges-page">

      <!-- Active challenge hero -->
      <div class="challenge-hero glass-card" style="border-color:${challenge.color}44">
        <div class="challenge-hero-left">
          <div class="challenge-big-icon-wrap" style="background:${challenge.color}22">
            <span class="challenge-big-icon">${challenge.icon}</span>
          </div>
        </div>
        <div class="challenge-hero-body">
          <span class="challenge-week-tag">🗓️ This Week's Challenge</span>
          <h2 class="challenge-hero-title">${challenge.name}</h2>
          <p class="challenge-hero-desc">${challenge.desc}</p>

          <!-- Progress -->
          <div class="challenge-progress-area">
            <div class="challenge-progress-hdr">
              <span>${passCount} / ${challenge.target} ${challenge.unit}</span>
              <span style="color:${challenge.color}; font-weight:700">${pct}%</span>
            </div>
            <div class="challenge-progress-track">
              <div class="challenge-progress-fill" style="width:${pct}%; background:${challenge.color}"></div>
            </div>
          </div>

          <!-- Day dots -->
          <div class="challenge-days">
            ${dayResults.map(dr => {
              let cls, symbol;
              if (!dr.isPast)       { cls = 'future';    symbol = '·'; }
              else if (!dr.log)     { cls = 'unlogged';  symbol = '?'; }
              else if (dr.result)   { cls = 'pass';      symbol = '✓'; }
              else                  { cls = 'fail';      symbol = '✗'; }
              return `
                <div class="challenge-day-wrap ${dr.isToday ? 'is-today' : ''}" aria-label="${dr.dayName}: ${cls}">
                  <div class="challenge-day-dot ${cls}"
                       style="${cls === 'pass' ? `background:${challenge.color}33;border-color:${challenge.color}` : ''}"
                       aria-hidden="true">
                    ${symbol}
                  </div>
                  <span class="challenge-day-lbl ${dr.isToday ? 'lbl-today' : ''}" aria-hidden="true">${dr.dayName}</span>
                </div>
              `;
            }).join('')}
          </div>

          <div class="challenge-foot">
            <span class="challenge-saving-note">💡 ${challenge.savingNote}</span>
            ${completed
              ? `<div class="challenge-reward-badge earned">${challenge.reward} 🎉</div>`
              : `<div class="challenge-reward-badge locked">Earn: ${challenge.reward}</div>`}
          </div>
        </div>
        ${completed ? `<div class="challenge-complete-seal">🏆<br><small>Complete!</small></div>` : ''}
      </div>

      <!-- All challenges -->
      <div class="challenges-all-card glass-card">
        <h3 class="challenges-all-title">🔄 All challenges (rotating weekly)</h3>
        <p class="challenges-all-sub">Each Monday a new challenge begins. Build habits one week at a time.</p>
        <div class="challenges-rotation-list">
          ${CHALLENGES.map(c => `
            <div class="rotation-row ${c.id === challenge.id ? 'rotation-active' : ''}">
              <span class="rotation-icon">${c.icon}</span>
              <div class="rotation-info">
                <strong>${c.name}</strong>
                <span>${c.desc.substring(0, 60)}…</span>
              </div>
              <div class="rotation-meta">
                <span class="rotation-reward">${c.reward}</span>
                ${c.id === challenge.id ? '<span class="rotation-active-badge">Active now</span>' : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

    </div>
  `;
}
