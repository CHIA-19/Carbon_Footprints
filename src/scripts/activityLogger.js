/**
 * activityLogger.js
 * =================
 * Handles the daily activity logging form UI and CO₂e calculation logic.
 *
 * CALCULATION APPROACH:
 *   Total daily CO₂e = transport_kg + food_kg + energy_kg + consumption_kg
 *   Each sub-total is derived from user inputs × emission factors (emissionFactors.js).
 *   Results are always presented as approximations (~).
 */

import { EMISSION_FACTORS, getTransportFactor, getFoodFactor, getElectricityFactor } from '../data/emissionFactors.js';
import { saveLog, loadTodayLog } from './storage.js';
import { sanitiseLogInputs } from './validation.js';

// ─────────────────────────────────────────────────────────────────
// CALCULATION FUNCTIONS (pure — no DOM, fully unit-testable)
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate transport CO₂e for a day.
 * @param {string} mode       — transport mode key
 * @param {string} subtype    — fuel/vehicle subtype (for car)
 * @param {number} distanceKm — distance travelled today in km
 * @returns {number} kg CO₂e
 */
export function calcTransportEmissions(mode, subtype, distanceKm) {
  // Defensive clamp: reject negative or non-finite distances
  const d = (isFinite(distanceKm) && distanceKm > 0) ? Math.min(distanceKm, 1000) : 0;
  if (d <= 0) return 0;
  const factor = getTransportFactor(mode, subtype);
  return parseFloat((factor * d).toFixed(3));
}

/**
 * Calculate food CO₂e for a day.
 * @param {number} meatMeals      — number of red-meat meals
 * @param {number} poultryMeals   — number of chicken/fish meals
 * @param {number} vegMeals       — number of vegetarian meals
 * @param {number} veganMeals     — number of vegan meals
 * @param {number} deliveryOrders — number of food delivery orders (overhead)
 * @returns {number} kg CO₂e
 */
export function calcFoodEmissions(meatMeals, poultryMeals, vegMeals, veganMeals, deliveryOrders) {
  const f = EMISSION_FACTORS.food;
  // Clamp all inputs: negative counts and NaN are treated as 0
  const clamp = (v, max = 10) => (isFinite(v) && v > 0) ? Math.min(v, max) : 0;
  const total =
    clamp(meatMeals)      * f.meal_beef +
    clamp(poultryMeals)   * f.meal_chicken +
    clamp(vegMeals)       * f.meal_vegetarian +
    clamp(veganMeals)     * f.meal_vegan +
    clamp(deliveryOrders) * f.delivery_overhead;
  return parseFloat(total.toFixed(3));
}

/**
 * Calculate home energy CO₂e for a day.
 * @param {number} acHours        — hours of AC/heating use
 * @param {number} electricityKwh — kWh of electricity (if user knows it)
 * @param {string} energyType     — 'grid' | 'renewable' | 'unsure'
 * @param {number} householdSize  — number of people sharing the home (to attribute share)
 * @returns {number} kg CO₂e (user's personal share)
 */
export function calcEnergyEmissions(acHours, electricityKwh, energyType, householdSize) {
  const e = EMISSION_FACTORS.energy;
  const elecFactor = getElectricityFactor(energyType || 'unsure');
  // householdSize must be at least 1; clamp to realistic range 1–20
  const hh = (isFinite(householdSize) && householdSize >= 1) ? Math.min(Math.floor(householdSize), 20) : 1;
  const ac  = (isFinite(acHours) && acHours > 0) ? Math.min(acHours, 24) : 0;
  const kwh = (isFinite(electricityKwh) && electricityKwh > 0) ? Math.min(electricityKwh, 200) : 0;

  let total = ac * e.ac_per_hour + kwh * elecFactor;
  return parseFloat((total / hh).toFixed(3));
}

/**
 * Calculate consumption/shopping CO₂e for a day.
 * @param {number} parcels         — number of online delivery parcels received
 * @param {number} clothingItems   — number of new clothing items bought
 * @param {number} electronicsSmall — small electronics items (earphones, etc.)
 * @returns {number} kg CO₂e
 */
export function calcConsumptionEmissions(parcels, clothingItems, electronicsSmall) {
  const c = EMISSION_FACTORS.consumption;
  const clamp = (v, max) => (isFinite(v) && v > 0) ? Math.min(v, max) : 0;
  const total =
    clamp(parcels, 50)          * c.online_parcel +
    clamp(clothingItems, 50)    * c.clothing_item +
    clamp(electronicsSmall, 20) * c.electronics_small;
  return parseFloat(total.toFixed(3));
}

/**
 * Bundle all category calculations into one totals object.
 * @param {Object} inputs — all form field values
 * @param {Object} profile — user baseline (for householdSize, energyType)
 * @returns {Object} totals — { transport, food, energy, consumption, total } in kg CO₂e
 */
export function calculateDayTotals(inputs, profile) {
  const transport   = calcTransportEmissions(inputs.transportMode, inputs.carFuelType, inputs.distanceKm);
  const food        = calcFoodEmissions(inputs.meatMeals, inputs.poultryMeals, inputs.vegMeals, inputs.veganMeals, inputs.deliveryOrders);
  const energy      = calcEnergyEmissions(inputs.acHours, inputs.electricityKwh, profile?.energyType, profile?.householdSize);
  const consumption = calcConsumptionEmissions(inputs.parcels, inputs.clothingItems, inputs.electronicsSmall);
  const total       = parseFloat((transport + food + energy + consumption).toFixed(3));
  return { transport, food, energy, consumption, total };
}

// ─────────────────────────────────────────────────────────────────
// UI RENDERING
// ─────────────────────────────────────────────────────────────────

/**
 * Render the activity logger form into #logger-section.
 * Pre-fills with today's existing log if available.
 * @param {Object} profile — user baseline profile
 * @param {Function} onSubmit — callback(log) called after successful save
 */
export function renderActivityLogger(profile, onSubmit) {
  const section = document.getElementById('logger-section');
  if (!section) return;

  const existingLog = loadTodayLog();
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const hasLogged = Boolean(existingLog);

  section.innerHTML = `
    <div class="logger-card glass-card">
      <div class="logger-header">
        <div class="logger-title-block">
          <span class="section-label">Daily Check-in</span>
          <h2>How was your day, ${profile?.name || 'friend'}?</h2>
          <p class="logger-date">${today}</p>
        </div>
        ${hasLogged ? '<span class="logged-badge">✓ Logged today</span>' : '<span class="pending-badge">● Not logged yet</span>'}
      </div>

      <form id="activity-form" novalidate>
        <!-- ── TRANSPORT ── -->
        <div class="form-section">
          <div class="form-section-header">
            <span class="category-icon">🚗</span>
            <div>
              <h3>Transport</h3>
              <p>How did you get around today?</p>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="transport-mode">Main mode</label>
              <select id="transport-mode" name="transportMode">
                <option value="car"        ${profile?.commuteMode === 'car'        ? 'selected':''}>🚗 Car</option>
                <option value="ev"         ${profile?.commuteMode === 'ev'         ? 'selected':''}>⚡ EV</option>
                <option value="motorbike"  ${profile?.commuteMode === 'motorbike'  ? 'selected':''}>🛵 Motorbike</option>
                <option value="bus"        ${profile?.commuteMode === 'bus'        ? 'selected':''}>🚌 Bus</option>
                <option value="train"      ${profile?.commuteMode === 'train'      ? 'selected':''}>🚆 Train / Metro</option>
                <option value="bike"       ${profile?.commuteMode === 'bike'       ? 'selected':''}>🚲 Bicycle</option>
                <option value="walk"       ${profile?.commuteMode === 'walk'       ? 'selected':''}>🚶 Walking</option>
                <option value="rideshare"  >🚕 Rideshare (Uber/Ola)</option>
              </select>
            </div>
            <div class="form-field" id="fuel-type-field" style="display:none">
              <label for="car-fuel">Car type</label>
              <select id="car-fuel" name="carFuelType">
                <option value="petrol" ${profile?.carFuelType==='petrol'?'selected':''}>Petrol</option>
                <option value="diesel" ${profile?.carFuelType==='diesel'?'selected':''}>Diesel</option>
                <option value="hybrid" ${profile?.carFuelType==='hybrid'?'selected':''}>Hybrid</option>
                <option value="ev"     ${profile?.carFuelType==='ev'    ?'selected':''}>EV</option>
              </select>
            </div>
            <div class="form-field">
              <label for="distance-km">Distance (km)</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="distance-km" data-delta="-5">−</button>
                <input type="number" id="distance-km" name="distanceKm" min="0" max="500" value="${existingLog?.transport?.distanceKm || 0}" placeholder="0">
                <button type="button" class="stepper-btn" data-target="distance-km" data-delta="5">+</button>
              </div>
              <span class="field-unit">km</span>
            </div>
          </div>
          <div class="live-calc" id="transport-live">~ 0.0 kg CO₂e</div>
        </div>

        <!-- ── FOOD ── -->
        <div class="form-section">
          <div class="form-section-header">
            <span class="category-icon">🍽️</span>
            <div>
              <h3>Food</h3>
              <p>What did you eat today?</p>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="meat-meals">🥩 Red meat meals</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="meat-meals" data-delta="-1">−</button>
                <input type="number" id="meat-meals" name="meatMeals" min="0" max="10" value="${existingLog?.food?.meatMeals || 0}">
                <button type="button" class="stepper-btn" data-target="meat-meals" data-delta="1">+</button>
              </div>
            </div>
            <div class="form-field">
              <label for="poultry-meals">🍗 Chicken/Fish meals</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="poultry-meals" data-delta="-1">−</button>
                <input type="number" id="poultry-meals" name="poultryMeals" min="0" max="10" value="${existingLog?.food?.poultryMeals || 0}">
                <button type="button" class="stepper-btn" data-target="poultry-meals" data-delta="1">+</button>
              </div>
            </div>
            <div class="form-field">
              <label for="veg-meals">🥗 Vegetarian meals</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="veg-meals" data-delta="-1">−</button>
                <input type="number" id="veg-meals" name="vegMeals" min="0" max="10" value="${existingLog?.food?.vegMeals || 0}">
                <button type="button" class="stepper-btn" data-target="veg-meals" data-delta="1">+</button>
              </div>
            </div>
            <div class="form-field">
              <label for="vegan-meals">🌱 Vegan meals</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="vegan-meals" data-delta="-1">−</button>
                <input type="number" id="vegan-meals" name="veganMeals" min="0" max="10" value="${existingLog?.food?.veganMeals || 0}">
                <button type="button" class="stepper-btn" data-target="vegan-meals" data-delta="1">+</button>
              </div>
            </div>
            <div class="form-field">
              <label for="delivery-orders">📦 Food deliveries</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="delivery-orders" data-delta="-1">−</button>
                <input type="number" id="delivery-orders" name="deliveryOrders" min="0" max="10" value="${existingLog?.food?.deliveryOrders || 0}">
                <button type="button" class="stepper-btn" data-target="delivery-orders" data-delta="1">+</button>
              </div>
            </div>
          </div>
          <div class="live-calc" id="food-live">~ 0.0 kg CO₂e</div>
        </div>

        <!-- ── ENERGY ── -->
        <div class="form-section">
          <div class="form-section-header">
            <span class="category-icon">⚡</span>
            <div>
              <h3>Home Energy</h3>
              <p>Heating, cooling, electricity today</p>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="ac-hours">AC / Heating (hrs)</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="ac-hours" data-delta="-1">−</button>
                <input type="number" id="ac-hours" name="acHours" min="0" max="24" value="${existingLog?.energy?.acHours || 0}">
                <button type="button" class="stepper-btn" data-target="ac-hours" data-delta="1">+</button>
              </div>
              <span class="field-unit">hours</span>
            </div>
            <div class="form-field">
              <label for="electricity-kwh">Electricity used <span class="optional-tag">optional</span></label>
              <input type="number" id="electricity-kwh" name="electricityKwh" min="0" max="100" step="0.5" value="${existingLog?.energy?.electricityKwh || ''}" placeholder="kWh (leave blank if unsure)">
              <span class="field-unit">kWh</span>
            </div>
          </div>
          <div class="live-calc" id="energy-live">~ 0.0 kg CO₂e</div>
        </div>

        <!-- ── CONSUMPTION ── -->
        <div class="form-section">
          <div class="form-section-header">
            <span class="category-icon">🛍️</span>
            <div>
              <h3>Shopping & Consumption</h3>
              <p>Online orders, new items bought today</p>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="parcels">📬 Parcels received</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="parcels" data-delta="-1">−</button>
                <input type="number" id="parcels" name="parcels" min="0" max="20" value="${existingLog?.consumption?.parcels || 0}">
                <button type="button" class="stepper-btn" data-target="parcels" data-delta="1">+</button>
              </div>
            </div>
            <div class="form-field">
              <label for="clothing-items">👕 New clothing items</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="clothing-items" data-delta="-1">−</button>
                <input type="number" id="clothing-items" name="clothingItems" min="0" max="20" value="${existingLog?.consumption?.clothingItems || 0}">
                <button type="button" class="stepper-btn" data-target="clothing-items" data-delta="1">+</button>
              </div>
            </div>
            <div class="form-field">
              <label for="electronics-small">🎧 Small electronics</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="electronics-small" data-delta="-1">−</button>
                <input type="number" id="electronics-small" name="electronicsSmall" min="0" max="10" value="${existingLog?.consumption?.electronicsSmall || 0}">
                <button type="button" class="stepper-btn" data-target="electronics-small" data-delta="1">+</button>
              </div>
            </div>
          </div>
          <div class="live-calc" id="consumption-live">~ 0.0 kg CO₂e</div>
        </div>

        <!-- ── TOTAL + SUBMIT ── -->
        <div class="logger-footer">
          <div class="total-preview">
            <span class="total-label">Today's estimate</span>
            <span class="total-value" id="total-live">~ 0.0 kg CO₂e</span>
            <button type="button" class="methodology-btn" id="methodology-btn" title="How we calculate this">ℹ️ Methodology</button>
          </div>
          <button type="submit" class="btn-primary" id="log-submit-btn">
            <span>${hasLogged ? '📝 Update Today\'s Log' : '✅ Save Today\'s Log'}</span>
          </button>
        </div>
      </form>
    </div>
  `;

  _initLoggerInteractions(profile, onSubmit);
}

// ─────────────────────────────────────────────────────────────────
// Internal: wire up interactions
// ─────────────────────────────────────────────────────────────────

function _initLoggerInteractions(profile, onSubmit) {
  const form = document.getElementById('activity-form');
  if (!form) return;

  // Show/hide car fuel type based on mode selection
  const modeSelect = document.getElementById('transport-mode');
  const fuelField  = document.getElementById('fuel-type-field');
  const updateFuelVisibility = () => {
    const isCar = ['car', 'rideshare'].includes(modeSelect.value);
    fuelField.style.display = isCar ? 'flex' : 'none';
  };
  modeSelect?.addEventListener('change', () => { updateFuelVisibility(); _updateLiveCalcs(profile); });
  updateFuelVisibility();

  // Stepper buttons
  form.querySelectorAll('.stepper-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const delta = parseFloat(btn.dataset.delta);
      const min = parseFloat(input.min ?? 0);
      const max = parseFloat(input.max ?? 9999);
      const newVal = Math.min(max, Math.max(min, (parseFloat(input.value) || 0) + delta));
      input.value = newVal;
      _updateLiveCalcs(profile);
    });
  });

  // Live update on any input change
  form.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', () => _updateLiveCalcs(profile));
  });

  // Methodology info popup
  document.getElementById('methodology-btn')?.addEventListener('click', () => {
    window.showMethodologyModal?.();
  });

  // Form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputs = _readFormInputs(form);
    const totals = calculateDayTotals(inputs, profile);
    const today  = new Date().toISOString().slice(0, 10);

    const log = {
      date: today,
      transport: { mode: inputs.transportMode, subtype: inputs.carFuelType, distanceKm: inputs.distanceKm },
      food: { meatMeals: inputs.meatMeals, poultryMeals: inputs.poultryMeals, vegMeals: inputs.vegMeals, veganMeals: inputs.veganMeals, deliveryOrders: inputs.deliveryOrders },
      energy: { acHours: inputs.acHours, electricityKwh: inputs.electricityKwh },
      consumption: { parcels: inputs.parcels, clothingItems: inputs.clothingItems, electronicsSmall: inputs.electronicsSmall },
      totals,
      loggedAt: new Date().toISOString(),
    };

    saveLog(log);
    onSubmit?.(log);
  });

  // Initial live calc
  _updateLiveCalcs(profile);
}

function _readFormInputs(form) {
  const fd = new FormData(form);
  // Read raw values, then pass through the validation/sanitisation layer
  const raw = {
    transportMode:    fd.get('transportMode') || 'car',
    carFuelType:      fd.get('carFuelType')   || 'petrol',
    distanceKm:       parseFloat(fd.get('distanceKm'))      || 0,
    meatMeals:        parseFloat(fd.get('meatMeals'))       || 0,
    poultryMeals:     parseFloat(fd.get('poultryMeals'))    || 0,
    vegMeals:         parseFloat(fd.get('vegMeals'))        || 0,
    veganMeals:       parseFloat(fd.get('veganMeals'))      || 0,
    deliveryOrders:   parseFloat(fd.get('deliveryOrders'))  || 0,
    acHours:          parseFloat(fd.get('acHours'))         || 0,
    electricityKwh:   parseFloat(fd.get('electricityKwh'))  || 0,
    parcels:          parseFloat(fd.get('parcels'))         || 0,
    clothingItems:    parseFloat(fd.get('clothingItems'))   || 0,
    electronicsSmall: parseFloat(fd.get('electronicsSmall'))|| 0,
  };
  // Sanitise all inputs — rejects nonsensical values (negatives, strings, out-of-range)
  return sanitiseLogInputs(raw);
}

function _updateLiveCalcs(profile) {
  const form = document.getElementById('activity-form');
  if (!form) return;
  const inputs = _readFormInputs(form);
  const totals = calculateDayTotals(inputs, profile);

  const setLive = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `~ ${val.toFixed(1)} kg CO₂e`;
  };
  setLive('transport-live',   totals.transport);
  setLive('food-live',        totals.food);
  setLive('energy-live',      totals.energy);
  setLive('consumption-live', totals.consumption);

  const totalEl = document.getElementById('total-live');
  if (totalEl) {
    totalEl.textContent = `~ ${totals.total.toFixed(1)} kg CO₂e`;
    // Color-code vs Paris budget
    const parisBudget = 5.5;
    totalEl.className = 'total-value ' + (totals.total > parisBudget * 2 ? 'val-high' : totals.total > parisBudget ? 'val-medium' : 'val-low');
  }
}
