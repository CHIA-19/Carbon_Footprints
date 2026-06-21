"use strict";
/**
 * storage.js
 * ==========
 * Single module responsible for ALL reads/writes to localStorage.
 * No other module should call localStorage directly.
 *
 * Keys used:
 *   CF_PROFILE        â€” onboarding baseline profile
 *   CF_LOGS           â€” array of daily activity logs
 *   CF_SUGGESTIONS    â€” history of suggestion IDs shown this week
 *   CF_GOAL           â€” user's weekly reduction goal (%)
 *   CF_SEEN_ONBOARDING â€” boolean flag
 */

const KEYS = {
  PROFILE:        'CF_PROFILE',
  LOGS:           'CF_LOGS',
  SUGGESTIONS:    'CF_SUGGESTIONS',
  GOAL:           'CF_GOAL',
  SEEN_ONBOARDING:'CF_SEEN_ONBOARDING',
  EVENTS:         'CF_EVENTS',         // one-off big events (flights, cruises)
  CHALLENGES:     'CF_CHALLENGES',     // current challenge override (reserved for future)
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Internal helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn(`[storage] Failed to read key "${key}":`, e);
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[storage] Failed to write key "${key}":`, e);
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Profile
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Save the user's onboarding profile.
 * @param {Object} profile
 * @param {string} profile.commuteMode     â€” 'car'|'ev'|'bus'|'train'|'bike'|'walk'|'motorbike'
 * @param {string} profile.carFuelType     â€” 'petrol'|'diesel'|'hybrid'|'ev' (only if commuteMode='car')
 * @param {string} profile.dietPattern     â€” 'meat_heavy'|'moderate'|'vegetarian'|'vegan'
 * @param {string} profile.energyType      â€” 'grid'|'renewable'|'unsure'
 * @param {number} profile.householdSize   â€” number of people sharing home energy
 * @param {string} profile.name            â€” optional first name for personalisation
 */
export function saveProfile(profile) {
  write(KEYS.PROFILE, { ...profile, savedAt: new Date().toISOString() });
}

export function loadProfile() {
  return read(KEYS.PROFILE);
}

export function hasCompletedOnboarding() {
  return Boolean(read(KEYS.SEEN_ONBOARDING));
}

export function markOnboardingComplete() {
  write(KEYS.SEEN_ONBOARDING, true);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Activity Logs
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Append a daily log entry. Each log has a dateKey (YYYY-MM-DD) as its identifier.
 * If a log already exists for today, it is replaced (one log per day).
 *
 * @param {Object} log
 * @param {string} log.date        â€” ISO date string YYYY-MM-DD
 * @param {Object} log.transport   â€” { mode, subtype, distanceKm }
 * @param {Object} log.food        â€” { meatMeals, vegMeals, veganMeals, deliveryOrders }
 * @param {Object} log.energy      â€” { acHours, heatingHours, electricityKwh }
 * @param {Object} log.consumption â€” { parcels, clothingItems, electronics }
 * @param {Object} log.totals      â€” { transport, food, energy, consumption, total } in kg CO2e
 */
export function saveLog(log) {
  const logs = read(KEYS.LOGS) || [];
  const idx = logs.findIndex(l => l.date === log.date);
  if (idx >= 0) {
    logs[idx] = log; // overwrite today
  } else {
    logs.push(log);
  }
  // Keep at most 90 days to limit storage size
  const trimmed = logs.sort((a, b) => a.date.localeCompare(b.date)).slice(-90);
  write(KEYS.LOGS, trimmed);
}

/** Returns all stored logs, sorted oldest-first. */
export function loadAllLogs() {
  return (read(KEYS.LOGS) || []).sort((a, b) => a.date.localeCompare(b.date));
}

/** Returns logs for the last N days (default 7). */
export function loadRecentLogs(days = 7) {
  const all = loadAllLogs();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return all.filter(l => l.date >= cutoffStr);
}

/** Returns today's log if it exists, else null. */
export function loadTodayLog() {
  const today = new Date().toISOString().slice(0, 10);
  const logs = read(KEYS.LOGS) || [];
  return logs.find(l => l.date === today) || null;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Suggestion History (to avoid repeating tips in the same week)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Record that a suggestion ID was shown today.
 * Clears history automatically when week changes.
 */
export function recordSuggestionShown(suggestionId) {
  const history = read(KEYS.SUGGESTIONS) || { weekStart: _currentWeekStart(), ids: [] };
  const thisWeek = _currentWeekStart();
  if (history.weekStart !== thisWeek) {
    // New week â€” reset
    write(KEYS.SUGGESTIONS, { weekStart: thisWeek, ids: [suggestionId] });
    return;
  }
  if (!history.ids.includes(suggestionId)) {
    history.ids.push(suggestionId);
  }
  write(KEYS.SUGGESTIONS, history);
}

export function getShownSuggestionIds() {
  const history = read(KEYS.SUGGESTIONS) || { weekStart: _currentWeekStart(), ids: [] };
  const thisWeek = _currentWeekStart();
  if (history.weekStart !== thisWeek) return [];
  return history.ids;
}

function _currentWeekStart() {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Goal
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Save the user's weekly reduction goal.
 * @param {number} percent â€” e.g. 10 means "reduce by 10%"
 */
export function saveGoal(percent) {
  write(KEYS.GOAL, { percent, savedAt: new Date().toISOString() });
}

export function loadGoal() {
  return read(KEYS.GOAL);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Special Events (one-off flights, road trips, etc.)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Save a one-off event (flight, cruise, road trip).
 * @param {Object} event â€” { date, type, description, kg, distanceKm }
 */
export function saveEvent(event) {
  const events = read(KEYS.EVENTS) || [];
  events.push({ ...event, id: Date.now().toString(), savedAt: new Date().toISOString() });
  write(KEYS.EVENTS, events.slice(-100)); // keep last 100
}

/**
 * Load special events in the last N days.
 * @param {number} [days=90]
 * @returns {Object[]}
 */
export function loadRecentEvents(days = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return (read(KEYS.EVENTS) || []).filter(e => (e.date || '') >= cutoffStr);
}

/**
 * Update the 'note' field of an existing day's log.
 * @param {string} date â€” YYYY-MM-DD
 * @param {string} note
 */
export function saveJournalNote(date, note) {
  const logs = read(KEYS.LOGS) || [];
  const idx  = logs.findIndex(l => l.date === date);
  if (idx >= 0) {
    logs[idx].note = note;
    write(KEYS.LOGS, logs);
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Utility: clear all data (for settings/reset)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function clearAllData() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

