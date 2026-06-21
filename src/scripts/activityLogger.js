"use strict";
/**
 * activityLogger.js
 * =================
 * Handles the daily activity logging form UI and COâ‚‚e calculation logic.
 *
 * CALCULATION APPROACH:
 *   Total daily COâ‚‚e = transport_kg + food_kg + energy_kg + consumption_kg
 *   Each sub-total is derived from user inputs Ã— emission factors (emissionFactors.js).
 *   Results are always presented as approximations (~).
 */

import {
  EMISSION_FACTORS,
  getTransportFactor,
  getFoodFactor,
  getElectricityFactor,
} from "../data/emissionFactors.js";
import { saveLog, loadTodayLog } from "./storage.js";
import { sanitiseLogInputs } from "./validation.js";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CALCULATION FUNCTIONS (pure â€” no DOM, fully unit-testable)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Calculate transport COâ‚‚e for a day.
 * @param {string} mode       â€” transport mode key
 * @param {string} subtype    â€” fuel/vehicle subtype (for car)
 * @param {number} distanceKm â€” distance travelled today in km
 * @returns {number} kg COâ‚‚e
 */
export function calcTransportEmissions(
  mode,
  subtype,
  distanceKm,
  shortFlightKm = 0,
  longFlightKm = 0,
) {
  // Defensive clamp: reject negative or non-finite distances
  const d =
    isFinite(distanceKm) && distanceKm > 0 ? Math.min(distanceKm, 1000) : 0;
  const sf =
    isFinite(shortFlightKm) && shortFlightKm > 0
      ? Math.min(shortFlightKm, 15000)
      : 0;
  const lf =
    isFinite(longFlightKm) && longFlightKm > 0
      ? Math.min(longFlightKm, 25000)
      : 0;
  const factor = d > 0 ? getTransportFactor(mode, subtype) : 0;
  const flightEmissions =
    sf * EMISSION_FACTORS.transport.flight_short +
    lf * EMISSION_FACTORS.transport.flight_long;
  return parseFloat((factor * d + flightEmissions).toFixed(3));
}

/**
 * Calculate food COâ‚‚e for a day.
 * @param {number} meatMeals      â€” number of red-meat meals
 * @param {number} poultryMeals   â€” number of chicken/fish meals
 * @param {number} vegMeals       â€” number of vegetarian meals
 * @param {number} veganMeals     â€” number of vegan meals
 * @param {number} deliveryOrders â€” number of food delivery orders (overhead)
 * @returns {number} kg COâ‚‚e
 */
export function calcFoodEmissions(
  meatMeals,
  poultryMeals,
  vegMeals,
  veganMeals,
  deliveryOrders,
) {
  const f = EMISSION_FACTORS.food;
  // Clamp all inputs: negative counts and NaN are treated as 0
  const clamp = (v, max = 10) => (isFinite(v) && v > 0 ? Math.min(v, max) : 0);
  const total =
    clamp(meatMeals) * f.meal_beef +
    clamp(poultryMeals) * f.meal_chicken +
    clamp(vegMeals) * f.meal_vegetarian +
    clamp(veganMeals) * f.meal_vegan +
    clamp(deliveryOrders) * f.delivery_overhead;
  return parseFloat(total.toFixed(3));
}

/**
 * Calculate home energy COâ‚‚e for a day.
 * @param {number} acHours        â€” hours of AC/heating use
 * @param {number} electricityKwh â€” kWh of electricity (if user knows it)
 * @param {string} energyType     â€” 'grid' | 'renewable' | 'unsure'
 * @param {number} householdSize  â€” number of people sharing the home (to attribute share)
 * @returns {number} kg COâ‚‚e (user's personal share)
 */
export function calcEnergyEmissions(
  acHours,
  electricityKwh,
  energyType,
  householdSize,
  country = null,
) {
  const e = EMISSION_FACTORS.energy;
  const elecFactor = getElectricityFactor(energyType || "unsure", country);
  // householdSize must be at least 1; clamp to realistic range 1â€“20
  const hh =
    isFinite(householdSize) && householdSize >= 1
      ? Math.min(Math.floor(householdSize), 20)
      : 1;
  const ac = isFinite(acHours) && acHours > 0 ? Math.min(acHours, 24) : 0;
  const kwh =
    isFinite(electricityKwh) && electricityKwh > 0
      ? Math.min(electricityKwh, 200)
      : 0;

  let total = ac * e.ac_per_hour + kwh * elecFactor;
  return parseFloat((total / hh).toFixed(3));
}

/**
 * Calculate consumption/shopping COâ‚‚e for a day.
 * @param {number} parcels         â€” number of online delivery parcels received
 * @param {number} clothingItems   â€” number of new clothing items bought
 * @param {number} electronicsSmall â€” small electronics items (earphones, etc.)
 * @returns {number} kg COâ‚‚e
 */
export function calcConsumptionEmissions(
  parcels,
  clothingItems,
  electronicsSmall,
) {
  const c = EMISSION_FACTORS.consumption;
  const clamp = (v, max) => (isFinite(v) && v > 0 ? Math.min(v, max) : 0);
  const total =
    clamp(parcels, 50) * c.online_parcel +
    clamp(clothingItems, 50) * c.clothing_item +
    clamp(electronicsSmall, 20) * c.electronics_small;
  return parseFloat(total.toFixed(3));
}

/**
 * Bundle all category calculations into one totals object.
 * @param {Object} inputs â€” all form field values
 * @param {Object} profile â€” user baseline (for householdSize, energyType)
 * @returns {Object} totals â€” { transport, food, energy, consumption, total } in kg COâ‚‚e
 */
export function calculateDayTotals(inputs, profile) {
  const transport = calcTransportEmissions(
    inputs.transportMode,
    inputs.carFuelType,
    inputs.distanceKm,
    inputs.shortFlightKm,
    inputs.longFlightKm,
  );
  const food = calcFoodEmissions(
    inputs.meatMeals,
    inputs.poultryMeals,
    inputs.vegMeals,
    inputs.veganMeals,
    inputs.deliveryOrders,
  );
  const energy = calcEnergyEmissions(
    inputs.acHours,
    inputs.electricityKwh,
    profile?.energyType,
    profile?.householdSize,
    profile?.country,
  );
  const consumption = calcConsumptionEmissions(
    inputs.parcels,
    inputs.clothingItems,
    inputs.electronicsSmall,
  );
  const total = parseFloat(
    (transport + food + energy + consumption).toFixed(3),
  );
  return { transport, food, energy, consumption, total };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// UI RENDERING
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Render the activity logger form into #logger-section.
 * Pre-fills with today's existing log if available.
 * @param {Object} profile â€” user baseline profile
 * @param {Function} onSubmit â€” callback(log) called after successful save
 */
export function renderActivityLogger(profile, onSubmit) {
  const section = document.getElementById("logger-section");
  if (!section) return;

  const existingLog = loadTodayLog();
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const hasLogged = Boolean(existingLog);

  section.innerHTML = `
    <div class="logger-card glass-card">
      <div class="logger-header">
        <div class="logger-title-block">
          <span class="section-label">Daily Check-in</span>
          <h2>How was your day, ${profile?.name || "friend"}?</h2>
          <p class="logger-date">${today}</p>
        </div>
        ${hasLogged ? '<span class="logged-badge">âœ“ Logged today</span>' : '<span class="pending-badge">â— Not logged yet</span>'}
      </div>

      <form id="activity-form" novalidate>
        <!-- â”€â”€ TRANSPORT â”€â”€ -->
        <div class="form-section">
          <div class="form-section-header">
            <span class="category-icon">ðŸš—</span>
            <div>
              <h3>Transport</h3>
              <p>How did you get around today?</p>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="transport-mode">Main mode</label>
              <select id="transport-mode" name="transportMode">
                <option value="car"        ${profile?.commuteMode === "car" ? "selected" : ""}>ðŸš— Car</option>
                <option value="ev"         ${profile?.commuteMode === "ev" ? "selected" : ""}>âš¡ EV</option>
                <option value="motorbike"  ${profile?.commuteMode === "motorbike" ? "selected" : ""}>ðŸ›µ Motorbike</option>
                <option value="bus"        ${profile?.commuteMode === "bus" ? "selected" : ""}>ðŸšŒ Bus</option>
                <option value="train"      ${profile?.commuteMode === "train" ? "selected" : ""}>ðŸš† Train / Metro</option>
                <option value="bike"       ${profile?.commuteMode === "bike" ? "selected" : ""}>ðŸš² Bicycle</option>
                <option value="walk"       ${profile?.commuteMode === "walk" ? "selected" : ""}>ðŸš¶ Walking</option>
                <option value="rideshare"  >ðŸš• Rideshare (Uber/Ola)</option>
              </select>
            </div>
            <div class="form-field" id="fuel-type-field" style="display:none">
              <label for="car-fuel">Car type</label>
              <select id="car-fuel" name="carFuelType">
                <option value="petrol" ${profile?.carFuelType === "petrol" ? "selected" : ""}>Petrol</option>
                <option value="diesel" ${profile?.carFuelType === "diesel" ? "selected" : ""}>Diesel</option>
                <option value="hybrid" ${profile?.carFuelType === "hybrid" ? "selected" : ""}>Hybrid</option>
                <option value="ev"     ${profile?.carFuelType === "ev" ? "selected" : ""}>EV</option>
              </select>
            </div>
            <div class="form-field">
              <label for="distance-km">Distance (km)</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="distance-km" data-delta="-5">âˆ’</button>
                <input type="number" id="distance-km" name="distanceKm" min="0" max="500" value="${existingLog?.transport?.distanceKm || 0}" placeholder="0">
                <button type="button" class="stepper-btn" data-target="distance-km" data-delta="5">+</button>
              </div>
              <span class="field-unit">km</span>
            </div>
          </div>
          <div class="live-calc" id="transport-live">~ 0.0 kg COâ‚‚e</div>
        </div>

        <!-- â”€â”€ FOOD â”€â”€ -->
        <div class="form-section">
          <div class="form-section-header">
            <span class="category-icon">ðŸ½ï¸</span>
            <div>
              <h3>Food</h3>
              <p>What did you eat today?</p>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="meat-meals">ðŸ¥© Red meat meals</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="meat-meals" data-delta="-1">âˆ’</button>
                <input type="number" id="meat-meals" name="meatMeals" min="0" max="10" value="${existingLog?.food?.meatMeals || 0}">
                <button type="button" class="stepper-btn" data-target="meat-meals" data-delta="1">+</button>
              </div>
            </div>
            <div class="form-field">
              <label for="poultry-meals">ðŸ— Chicken/Fish meals</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="poultry-meals" data-delta="-1">âˆ’</button>
                <input type="number" id="poultry-meals" name="poultryMeals" min="0" max="10" value="${existingLog?.food?.poultryMeals || 0}">
                <button type="button" class="stepper-btn" data-target="poultry-meals" data-delta="1">+</button>
              </div>
            </div>
            <div class="form-field">
              <label for="veg-meals">ðŸ¥— Vegetarian meals</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="veg-meals" data-delta="-1">âˆ’</button>
                <input type="number" id="veg-meals" name="vegMeals" min="0" max="10" value="${existingLog?.food?.vegMeals || 0}">
                <button type="button" class="stepper-btn" data-target="veg-meals" data-delta="1">+</button>
              </div>
            </div>
            <div class="form-field">
              <label for="vegan-meals">ðŸŒ± Vegan meals</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="vegan-meals" data-delta="-1">âˆ’</button>
                <input type="number" id="vegan-meals" name="veganMeals" min="0" max="10" value="${existingLog?.food?.veganMeals || 0}">
                <button type="button" class="stepper-btn" data-target="vegan-meals" data-delta="1">+</button>
              </div>
            </div>
            <div class="form-field">
              <label for="delivery-orders">ðŸ“¦ Food deliveries</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="delivery-orders" data-delta="-1">âˆ’</button>
                <input type="number" id="delivery-orders" name="deliveryOrders" min="0" max="10" value="${existingLog?.food?.deliveryOrders || 0}">
                <button type="button" class="stepper-btn" data-target="delivery-orders" data-delta="1">+</button>
              </div>
            </div>
          </div>
          <div class="live-calc" id="food-live">~ 0.0 kg COâ‚‚e</div>
        </div>

        <!-- â”€â”€ ENERGY â”€â”€ -->
        <div class="form-section">
          <div class="form-section-header">
            <span class="category-icon">âš¡</span>
            <div>
              <h3>Home Energy</h3>
              <p>Heating, cooling, electricity today</p>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="ac-hours">AC / Heating (hrs)</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="ac-hours" data-delta="-1">âˆ’</button>
                <input type="number" id="ac-hours" name="acHours" min="0" max="24" value="${existingLog?.energy?.acHours || 0}">
                <button type="button" class="stepper-btn" data-target="ac-hours" data-delta="1">+</button>
              </div>
              <span class="field-unit">hours</span>
            </div>
            <div class="form-field">
              <label for="electricity-kwh">Electricity used <span class="optional-tag">optional</span></label>
              <input type="number" id="electricity-kwh" name="electricityKwh" min="0" max="100" step="0.5" value="${existingLog?.energy?.electricityKwh || ""}" placeholder="kWh (leave blank if unsure)">
              <span class="field-unit">kWh</span>
            </div>
          </div>
          <div class="live-calc" id="energy-live">~ 0.0 kg COâ‚‚e</div>
        </div>

        <!-- â”€â”€ CONSUMPTION â”€â”€ -->
        <div class="form-section">
          <div class="form-section-header">
            <span class="category-icon">ðŸ›ï¸</span>
            <div>
              <h3>Shopping & Consumption</h3>
              <p>Online orders, new items bought today</p>
            </div>
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="parcels">ðŸ“¬ Parcels received</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="parcels" data-delta="-1">âˆ’</button>
                <input type="number" id="parcels" name="parcels" min="0" max="20" value="${existingLog?.consumption?.parcels || 0}">
                <button type="button" class="stepper-btn" data-target="parcels" data-delta="1">+</button>
              </div>
            </div>
            <div class="form-field">
              <label for="clothing-items">ðŸ‘• New clothing items</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="clothing-items" data-delta="-1">âˆ’</button>
                <input type="number" id="clothing-items" name="clothingItems" min="0" max="20" value="${existingLog?.consumption?.clothingItems || 0}">
                <button type="button" class="stepper-btn" data-target="clothing-items" data-delta="1">+</button>
              </div>
            </div>
            <div class="form-field">
              <label for="electronics-small">ðŸŽ§ Small electronics</label>
              <div class="stepper-field">
                <button type="button" class="stepper-btn" data-target="electronics-small" data-delta="-1">âˆ’</button>
                <input type="number" id="electronics-small" name="electronicsSmall" min="0" max="10" value="${existingLog?.consumption?.electronicsSmall || 0}">
                <button type="button" class="stepper-btn" data-target="electronics-small" data-delta="1">+</button>
              </div>
            </div>
          </div>
          <div class="live-calc" id="consumption-live">~ 0.0 kg COâ‚‚e</div>
        </div>

        <!-- â”€â”€ FLIGHTS (collapsible) â”€â”€ -->
        <div class="form-section flight-section">
          <button type="button" class="flight-toggle-btn" id="flight-toggle">
            <span class="flight-toggle-icon">âœˆï¸</span>
            <span>Log a flight or long-distance trip today</span>
            <span class="flight-toggle-arrow" id="flight-arrow">â–¼</span>
          </button>
          <div id="flight-fields" class="flight-fields hidden">
            <p class="flight-info-note">Flight factors: short-haul 0.255 kg/km, long-haul 0.195 kg/km per passenger (DEFRA 2023)</p>
            <div class="form-row">
              <div class="form-field">
                <label for="short-flight-km">âœˆï¸ Short-haul flight (&lt;3h)</label>
                <div class="stepper-field">
                  <button type="button" class="stepper-btn" data-target="short-flight-km" data-delta="-200">âˆ’</button>
                  <input type="number" id="short-flight-km" name="shortFlightKm" min="0" max="5000" value="${existingLog?.transport?.shortFlightKm || 0}" placeholder="0">
                  <button type="button" class="stepper-btn" data-target="short-flight-km" data-delta="200">+</button>
                </div>
                <span class="field-unit">km</span>
              </div>
              <div class="form-field">
                <label for="long-flight-km">âœˆï¸ Long-haul flight (&gt;3h)</label>
                <div class="stepper-field">
                  <button type="button" class="stepper-btn" data-target="long-flight-km" data-delta="-500">âˆ’</button>
                  <input type="number" id="long-flight-km" name="longFlightKm" min="0" max="20000" value="${existingLog?.transport?.longFlightKm || 0}" placeholder="0">
                  <button type="button" class="stepper-btn" data-target="long-flight-km" data-delta="500">+</button>
                </div>
                <span class="field-unit">km</span>
              </div>
            </div>
            <div class="live-calc" id="flight-live">~ 0.0 kg COâ‚‚e from flights</div>
          </div>
        </div>

        <!-- â”€â”€ JOURNAL NOTE â”€â”€ -->
        <div class="form-section journal-section">
          <div class="form-section-header">
            <span class="category-icon">ðŸ““</span>
            <div>
              <h3>Today's Note <span class="optional-tag">optional</span></h3>
              <p>Anything notable about today? Shows as a tooltip in your heatmap.</p>
            </div>
          </div>
          <textarea id="journal-note" class="journal-textarea" rows="2" maxlength="200" placeholder="e.g. 'Took the train instead of driving today!'">${existingLog?.note || ""}</textarea>
        </div>

        <!-- â”€â”€ TOTAL + SUBMIT â”€â”€ -->
        <div class="logger-footer">
          <div class="total-preview">
            <span class="total-label">Today's estimate</span>
            <span class="total-value" id="total-live">~ 0.0 kg COâ‚‚e</span>
            <button type="button" class="methodology-btn" id="methodology-btn" title="How we calculate this">â„¹ï¸ Methodology</button>
          </div>
          <button type="submit" class="btn-primary" id="log-submit-btn">
            <span>${hasLogged ? "ðŸ“ Update Today's Log" : "âœ… Save Today's Log"}</span>
          </button>
        </div>
      </form>
    </div>
  `;

  _initLoggerInteractions(profile, onSubmit);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Internal: wire up interactions
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * @description Internal function
 * @internal
 */
function _initLoggerInteractions(profile, onSubmit) {
  const form = document.getElementById("activity-form");
  if (!form) return;

  // Show/hide car fuel type based on mode selection
  const modeSelect = document.getElementById("transport-mode");
  const fuelField = document.getElementById("fuel-type-field");
  const updateFuelVisibility = () => {
    const isCar = ["car", "rideshare"].includes(modeSelect.value);
    fuelField.style.display = isCar ? "flex" : "none";
  };
  modeSelect?.addEventListener("change", () => {
    updateFuelVisibility();
    _updateLiveCalcs(profile);
  });
  updateFuelVisibility();

  // Stepper buttons
  form.querySelectorAll(".stepper-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const delta = parseFloat(btn.dataset.delta);
      const min = parseFloat(input.min ?? 0);
      const max = parseFloat(input.max ?? 9999);
      const newVal = Math.min(
        max,
        Math.max(min, (parseFloat(input.value) || 0) + delta),
      );
      input.value = newVal;
      _updateLiveCalcs(profile);
    });
  });

  // Live update on any input change
  form.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", () => _updateLiveCalcs(profile));
  });

  // Methodology info popup
  document.getElementById("methodology-btn")?.addEventListener("click", () => {
    window.showMethodologyModal?.();
  });

  // Form submit
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const inputs = _readFormInputs(form);
    const totals = calculateDayTotals(inputs, profile);
    const today = new Date().toISOString().slice(0, 10);

    const log = {
      date: today,
      transport: {
        mode: inputs.transportMode,
        subtype: inputs.carFuelType,
        distanceKm: inputs.distanceKm,
        shortFlightKm: inputs.shortFlightKm,
        longFlightKm: inputs.longFlightKm,
      },
      food: {
        meatMeals: inputs.meatMeals,
        poultryMeals: inputs.poultryMeals,
        vegMeals: inputs.vegMeals,
        veganMeals: inputs.veganMeals,
        deliveryOrders: inputs.deliveryOrders,
      },
      energy: {
        acHours: inputs.acHours,
        electricityKwh: inputs.electricityKwh,
      },
      consumption: {
        parcels: inputs.parcels,
        clothingItems: inputs.clothingItems,
        electronicsSmall: inputs.electronicsSmall,
      },
      note: inputs.note || "",
      totals,
      loggedAt: new Date().toISOString(),
    };

    saveLog(log);
    onSubmit?.(log);
  });

  // Flight section toggle
  document.getElementById("flight-toggle")?.addEventListener("click", () => {
    const fields = document.getElementById("flight-fields");
    const arrow = document.getElementById("flight-arrow");
    const open = !fields.classList.contains("hidden");
    fields.classList.toggle("hidden", open);
    if (arrow) arrow.textContent = open ? "â–¼" : "â–²";
    if (!open) _updateLiveCalcs(profile);
  });

  // Initial live calc
  _updateLiveCalcs(profile);
}

/**
 * @description Internal function
 * @internal
 */
function _readFormInputs(form) {
  const fd = new FormData(form);
  // Read raw values, then pass through the validation/sanitisation layer
  const raw = {
    transportMode: fd.get("transportMode") || "car",
    carFuelType: fd.get("carFuelType") || "petrol",
    distanceKm: parseFloat(fd.get("distanceKm")) || 0,
    shortFlightKm: parseFloat(fd.get("shortFlightKm")) || 0,
    longFlightKm: parseFloat(fd.get("longFlightKm")) || 0,
    meatMeals: parseFloat(fd.get("meatMeals")) || 0,
    poultryMeals: parseFloat(fd.get("poultryMeals")) || 0,
    vegMeals: parseFloat(fd.get("vegMeals")) || 0,
    veganMeals: parseFloat(fd.get("veganMeals")) || 0,
    deliveryOrders: parseFloat(fd.get("deliveryOrders")) || 0,
    acHours: parseFloat(fd.get("acHours")) || 0,
    electricityKwh: parseFloat(fd.get("electricityKwh")) || 0,
    parcels: parseFloat(fd.get("parcels")) || 0,
    clothingItems: parseFloat(fd.get("clothingItems")) || 0,
    electronicsSmall: parseFloat(fd.get("electronicsSmall")) || 0,
    note: document.getElementById("journal-note")?.value?.trim() || "",
  };
  // Sanitise all numeric inputs â€” rejects nonsensical values (negatives, strings, out-of-range)
  return sanitiseLogInputs(raw);
}

/**
 * @description Internal function
 * @internal
 */
function _updateLiveCalcs(profile) {
  const form = document.getElementById("activity-form");
  if (!form) return;
  const inputs = _readFormInputs(form);
  const totals = calculateDayTotals(inputs, profile);

  const setLive = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `~ ${val.toFixed(1)} kg COâ‚‚e`;
  };
  setLive("transport-live", totals.transport);
  setLive("food-live", totals.food);
  setLive("energy-live", totals.energy);
  setLive("consumption-live", totals.consumption);

  // Flight live calc
  const sf = inputs.shortFlightKm || 0;
  const lf = inputs.longFlightKm || 0;
  const flightKg =
    sf * EMISSION_FACTORS.transport.flight_short +
    lf * EMISSION_FACTORS.transport.flight_long;
  const flightEl = document.getElementById("flight-live");
  if (flightEl)
    flightEl.textContent = `~ ${flightKg.toFixed(1)} kg COâ‚‚e from flights`;

  const totalEl = document.getElementById("total-live");
  if (totalEl) {
    totalEl.textContent = `~ ${totals.total.toFixed(1)} kg COâ‚‚e`;
    // Color-code vs Paris budget
    const parisBudget = 5.5;
    totalEl.className =
      "total-value " +
      (totals.total > parisBudget * 2
        ? "val-high"
        : totals.total > parisBudget
          ? "val-medium"
          : "val-low");
  }
}
