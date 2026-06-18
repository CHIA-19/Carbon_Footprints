/**
 * emissionFactors.js
 * ==================
 * Single source of truth for all CO2e emission factors used in the app.
 *
 * METHODOLOGY NOTE:
 * All figures are approximate averages drawn from publicly available sources.
 * They are presented as estimates (~), not precise measurements.
 * Results may vary based on local grid mix, vehicle efficiency, and other factors.
 *
 * PRIMARY SOURCES:
 *   - UK DEFRA GHG Conversion Factors 2023 (https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting)
 *   - EPA Emission Factors for Greenhouse Gas Inventories (2023)
 *   - IPCC AR6 (2021) — transport and diet life-cycle estimates
 *   - Our World in Data — "Food's carbon footprint" (Poore & Nemecek 2018)
 *   - IEA Electricity CO2 Intensity Data 2023 (world average ~0.436 kg CO2/kWh; India ~0.708)
 */

export const EMISSION_FACTORS = {

  // ─────────────────────────────────────────────────────────────────
  // TRANSPORT  (kg CO2e per km per passenger)
  // Source: DEFRA 2023 vehicle intensity factors
  // ─────────────────────────────────────────────────────────────────
  transport: {
    car: {
      petrol:  0.170,  // Average petrol/gasoline car, medium size — DEFRA 2023
      diesel:  0.156,  // Average diesel car, medium size — DEFRA 2023
      hybrid:  0.110,  // Petrol-electric hybrid — DEFRA 2023
      ev:      0.047,  // Battery EV on average global grid — DEFRA 2023 / IEA
      default: 0.170,  // Fallback if fuel type unknown
    },
    bus:         0.089,  // Average city bus per passenger-km — DEFRA 2023
    metro_train: 0.041,  // Urban metro/subway per passenger-km — DEFRA 2023
    train:       0.035,  // National rail per passenger-km — DEFRA 2023
    bike:        0.000,  // Zero direct emissions; manufacturing amortised over years
    walk:        0.000,  // Zero emissions
    motorbike:   0.114,  // Average motorbike/scooter — DEFRA 2023
    rideshare:   0.155,  // Rideshare (car, solo) — similar to car but slightly lower due to pooling potential
    flight_short: 0.255, // Short-haul flight < 3 hours, per passenger-km — DEFRA 2023
    flight_long:  0.195, // Long-haul flight, per passenger-km — DEFRA 2023
  },

  // ─────────────────────────────────────────────────────────────────
  // FOOD  (kg CO2e per meal or serving)
  // Source: Poore & Nemecek (2018), Science; avg meal size ~600 kcal
  // ─────────────────────────────────────────────────────────────────
  food: {
    // Meal type emissions — lifecycle including production, processing, transport
    meal_beef:        6.0,   // Beef-centred meal — Poore & Nemecek 2018
    meal_pork:        2.5,   // Pork-centred meal — Poore & Nemecek 2018
    meal_chicken:     1.8,   // Chicken-centred meal — Poore & Nemecek 2018
    meal_fish:        1.5,   // Average fish meal — Poore & Nemecek 2018
    meal_vegetarian:  0.7,   // Vegetarian (dairy/eggs OK) — Poore & Nemecek 2018
    meal_vegan:       0.4,   // Fully plant-based meal — Poore & Nemecek 2018

    // Food delivery overhead (packaging + delivery vehicle)
    // Source: Lifecycle analysis estimate, ~0.5–1.0 kg CO2e overhead per order
    delivery_overhead: 0.7,  // Per online food delivery order (packaging + last-mile)

    // Food waste: ~30% of food wasted doubles impact; we nudge but don't add automatically
    waste_multiplier_high: 1.3, // Moderate waste proxy
  },

  // ─────────────────────────────────────────────────────────────────
  // ENERGY — HOME  (kg CO2e per unit)
  // Source: IEA 2023 world average grid; EPA US average; DEFRA UK
  // India grid intensity: ~0.708 kg CO2e/kWh (CEA 2022)
  // ─────────────────────────────────────────────────────────────────
  energy: {
    // Electricity: kg CO2e per kWh
    electricity_grid:      0.436, // World average — IEA 2023
    electricity_renewable: 0.020, // Certified renewable/solar — lifecycle estimate
    electricity_unsure:    0.436, // Use world average when user is unsure

    // Heating/Cooling approximations per hour of use
    // Rough average: 1.5 kW AC unit × grid intensity
    ac_per_hour:      0.654,  // 1.5 kW × 0.436 kg/kWh — world grid avg
    heating_gas_hour: 0.220,  // Natural gas space heater, ~1.2 kWh/hr equivalent — DEFRA
    heating_elec_hour: 0.654, // Electric heater 1.5 kW — same as AC proxy

    // Natural gas: kg CO2e per kWh of gas energy
    natural_gas_kwh: 0.204,   // DEFRA 2023 gross calorific value

    // Appliance averages per day (background baseline, not directly logged)
    // Used only for onboarding baseline estimate
    typical_home_daily_kwh: 10, // Average urban household kWh/day (approx)
  },

  // ─────────────────────────────────────────────────────────────────
  // CONSUMPTION / SHOPPING  (kg CO2e per item or order)
  // Source: Carbon Trust / lifecycle analysis estimates
  // ─────────────────────────────────────────────────────────────────
  consumption: {
    online_parcel:    0.5,   // Average last-mile delivery parcel — Carbon Trust est.
    clothing_item:    20.0,  // Average new garment (cotton t-shirt ~7 kg, jeans ~33 kg, avg ~20) — lifecycle
    electronics_small: 30.0, // Small electronics (earphones, charger etc.) — lifecycle avg
    electronics_large: 200.0, // Large device (laptop, phone) — lifecycle avg
    streaming_hour:   0.036, // Video streaming per hour (global avg) — IEA / Carbon Trust 2023
  },

  // ─────────────────────────────────────────────────────────────────
  // REFERENCE BASELINES  (for comparisons)
  // ─────────────────────────────────────────────────────────────────
  baselines: {
    global_avg_annual_kg:   4700,  // ~4.7 t CO2e/person/year — Our World in Data 2022
    paris_target_annual_kg: 2000,  // ~2.0 t CO2e/person/year to meet 1.5°C pathway
    global_avg_daily_kg:    12.9,  // 4700 / 365
    paris_target_daily_kg:   5.5,  // 2000 / 365

    // Relatable equivalences
    car_km_per_kg_co2:  5.88,   // 1 kg CO2e ≈ 5.88 km in average petrol car (1/0.170)
    tree_offset_kg_year: 21,    // One mature tree absorbs ~21 kg CO2/year (IPCC estimate)
    smartphone_charges_per_kg: 121, // 1 kg CO2e ~ charging a smartphone 121 times
  }
};

/**
 * Helper: Get transport emission factor for a given mode and sub-type.
 * @param {string} mode - e.g. 'car', 'bus', 'train'
 * @param {string} [subtype] - e.g. 'petrol', 'diesel', 'ev' (for car)
 * @returns {number} kg CO2e per km
 */
export function getTransportFactor(mode, subtype = null) {
  const t = EMISSION_FACTORS.transport;
  if (mode === 'car' && subtype && t.car[subtype] !== undefined) {
    return t.car[subtype];
  }
  if (mode === 'car') return t.car.default;
  return t[mode] ?? t.car.default;
}

/**
 * Helper: Get food emission factor for a given meal type.
 * @param {string} mealType - e.g. 'meal_beef', 'meal_vegan'
 * @returns {number} kg CO2e per meal
 */
export function getFoodFactor(mealType) {
  return EMISSION_FACTORS.food[mealType] ?? EMISSION_FACTORS.food.meal_vegetarian;
}

/**
 * Helper: Get electricity factor based on user's energy profile.
 * @param {string} energyType - 'grid' | 'renewable' | 'unsure'
 * @returns {number} kg CO2e per kWh
 */
export function getElectricityFactor(energyType) {
  const map = {
    grid:      EMISSION_FACTORS.energy.electricity_grid,
    renewable: EMISSION_FACTORS.energy.electricity_renewable,
    unsure:    EMISSION_FACTORS.energy.electricity_unsure,
  };
  return map[energyType] ?? EMISSION_FACTORS.energy.electricity_unsure;
}
