"use strict";
/**
 * validation.js
 * =============
 * Input validation and sanitisation for all user-supplied values.
 * Called by activityLogger.js before computing COâ‚‚e totals.
 *
 * SECURITY NOTES:
 *   - All numeric inputs are clamped to realistic ranges to prevent
 *     nonsensical values (e.g. -5 km, 10000 meals) from skewing calculations.
 *   - No user input is ever sent to a server; all processing is client-side.
 *   - No PII is collected; the "name" field is a local display hint only.
 *   - Strings are trimmed to avoid whitespace-only inputs being treated as valid.
 */

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ALLOWED VALUES (whitelist approach for string fields)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ALLOWED_TRANSPORT_MODES = new Set([
  "car",
  "ev",
  "motorbike",
  "bus",
  "train",
  "bike",
  "walk",
  "rideshare",
]);

const ALLOWED_CAR_FUEL_TYPES = new Set(["petrol", "diesel", "hybrid", "ev"]);

const ALLOWED_ENERGY_TYPES = new Set(["grid", "renewable", "unsure"]);

const ALLOWED_DIET_PATTERNS = new Set([
  "meat_heavy",
  "moderate",
  "vegetarian",
  "vegan",
]);

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// NUMERIC FIELD BOUNDS (min, max â€” inclusive)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const FIELD_BOUNDS = {
  distanceKm: { min: 0, max: 1000 }, // 1000 km/day is an extreme road trip, realistic ceiling
  meatMeals: { min: 0, max: 10 },
  poultryMeals: { min: 0, max: 10 },
  vegMeals: { min: 0, max: 10 },
  veganMeals: { min: 0, max: 10 },
  deliveryOrders: { min: 0, max: 10 },
  acHours: { min: 0, max: 24 }, // max 24 hrs in a day
  electricityKwh: { min: 0, max: 200 }, // 200 kWh/day is far beyond any household
  parcels: { min: 0, max: 50 },
  clothingItems: { min: 0, max: 50 },
  electronicsSmall: { min: 0, max: 20 },
  householdSize: { min: 1, max: 20 },
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// VALIDATORS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Clamp a number to [min, max]. Returns 0 if not a finite number.
 * This prevents NaN, Infinity, and absurd values from entering calculations.
 *
 * @param {any} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clampNumber(value, min, max) {
  const n = parseFloat(value);
  if (!isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Validate and sanitise a transport mode string.
 * Falls back to 'car' if the value is not in the allowed set.
 *
 * @param {string} mode
 * @returns {string}
 */
export function sanitiseTransportMode(mode) {
  const cleaned = String(mode || "")
    .trim()
    .toLowerCase();
  return ALLOWED_TRANSPORT_MODES.has(cleaned) ? cleaned : "car";
}

/**
 * Validate a car fuel type.
 * Falls back to 'petrol' if unknown.
 *
 * @param {string} fuelType
 * @returns {string}
 */
export function sanitiseCarFuelType(fuelType) {
  const cleaned = String(fuelType || "")
    .trim()
    .toLowerCase();
  return ALLOWED_CAR_FUEL_TYPES.has(cleaned) ? cleaned : "petrol";
}

/**
 * Validate an energy type string.
 * Falls back to 'unsure' â€” the safest/most conservative option.
 *
 * @param {string} energyType
 * @returns {string}
 */
export function sanitiseEnergyType(energyType) {
  const cleaned = String(energyType || "")
    .trim()
    .toLowerCase();
  return ALLOWED_ENERGY_TYPES.has(cleaned) ? cleaned : "unsure";
}

/**
 * Validate a diet pattern string.
 * Falls back to 'moderate'.
 *
 * @param {string} diet
 * @returns {string}
 */
export function sanitiseDietPattern(diet) {
  const cleaned = String(diet || "")
    .trim()
    .toLowerCase();
  return ALLOWED_DIET_PATTERNS.has(cleaned) ? cleaned : "moderate";
}

/**
 * Sanitise a display name (optional, local only).
 * Strips to max 30 chars, trims whitespace, removes HTML tags.
 *
 * @param {string} name
 * @returns {string}
 */
export function sanitiseName(name) {
  return String(name || "")
    .trim()
    .replace(/<[^>]*>/g, "") // strip any HTML tags
    .slice(0, 30);
}

/**
 * Validate and sanitise all form inputs in one call.
 * Returns a clean, safe inputs object ready for calculation.
 *
 * @param {Object} raw â€” raw form inputs
 * @returns {Object} sanitised inputs
 */
export function sanitiseLogInputs(raw) {
  return {
    transportMode: sanitiseTransportMode(raw.transportMode),
    carFuelType: sanitiseCarFuelType(raw.carFuelType),
    distanceKm: clampNumber(
      raw.distanceKm,
      FIELD_BOUNDS.distanceKm.min,
      FIELD_BOUNDS.distanceKm.max,
    ),
    meatMeals: clampNumber(
      raw.meatMeals,
      FIELD_BOUNDS.meatMeals.min,
      FIELD_BOUNDS.meatMeals.max,
    ),
    poultryMeals: clampNumber(
      raw.poultryMeals,
      FIELD_BOUNDS.poultryMeals.min,
      FIELD_BOUNDS.poultryMeals.max,
    ),
    vegMeals: clampNumber(
      raw.vegMeals,
      FIELD_BOUNDS.vegMeals.min,
      FIELD_BOUNDS.vegMeals.max,
    ),
    veganMeals: clampNumber(
      raw.veganMeals,
      FIELD_BOUNDS.veganMeals.min,
      FIELD_BOUNDS.veganMeals.max,
    ),
    deliveryOrders: clampNumber(
      raw.deliveryOrders,
      FIELD_BOUNDS.deliveryOrders.min,
      FIELD_BOUNDS.deliveryOrders.max,
    ),
    acHours: clampNumber(
      raw.acHours,
      FIELD_BOUNDS.acHours.min,
      FIELD_BOUNDS.acHours.max,
    ),
    electricityKwh: clampNumber(
      raw.electricityKwh,
      FIELD_BOUNDS.electricityKwh.min,
      FIELD_BOUNDS.electricityKwh.max,
    ),
    parcels: clampNumber(
      raw.parcels,
      FIELD_BOUNDS.parcels.min,
      FIELD_BOUNDS.parcels.max,
    ),
    clothingItems: clampNumber(
      raw.clothingItems,
      FIELD_BOUNDS.clothingItems.min,
      FIELD_BOUNDS.clothingItems.max,
    ),
    electronicsSmall: clampNumber(
      raw.electronicsSmall,
      FIELD_BOUNDS.electronicsSmall.min,
      FIELD_BOUNDS.electronicsSmall.max,
    ),
  };
}
