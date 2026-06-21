"use strict";
/**
 * onboarding.js
 * =============
 * Handles the one-time onboarding flow: 6 quick questions to build the user's
 * baseline profile stored in localStorage via storage.js.
 *
 * Steps:
 *   1. Name (optional)
 *   2. Commute mode
 *   3. Diet pattern
 *   4. Home energy type
 *   5. Country / region  â† NEW â€” sets country-specific electricity grid factor
 *   6. Household size
 */

import { saveProfile, markOnboardingComplete } from "./storage.js";
import { EMISSION_FACTORS } from "../data/emissionFactors.js";

/**
 * Render the onboarding overlay and handle profile collection.
 * @param {Function} onComplete â€” called with the saved profile when done
 */
export function renderOnboarding(onComplete) {
  const overlay = document.getElementById("onboarding-overlay");
  if (!overlay) return;

  // Build country options from emissionFactors data
  const countryEntries = Object.entries(
    EMISSION_FACTORS.gridIntensityByCountry || {},
  );
  const countryOptions = countryEntries
    .map(
      ([key, val]) =>
        `<button class="option-btn country-btn" data-value="${key}">${val.label}<small>${val.kg} kg/kWh</small></button>`,
    )
    .join("");

  overlay.classList.remove("hidden");
  overlay.innerHTML = `
    <div class="onboarding-card glass-card" role="dialog" aria-labelledby="ob-title">
      <div class="onboarding-logo">
        <span class="logo-icon">ðŸŒ</span>
        <span class="logo-text">CarbonLite</span>
      </div>

      <!-- â”€â”€ Step 1: Name â”€â”€ -->
      <div class="onboarding-step" id="ob-step-1">
        <div class="step-indicator">
          <span class="step-dot active"></span><span class="step-dot"></span><span class="step-dot"></span>
          <span class="step-dot"></span><span class="step-dot"></span><span class="step-dot"></span>
        </div>
        <h2 id="ob-title">Hey there! What's your name?</h2>
        <p class="ob-subtitle">Optional â€” just for a friendlier experience</p>
        <input type="text" id="ob-name" class="ob-input" placeholder="Your first name (or skip)" maxlength="30" autocomplete="given-name">
        <button class="btn-primary" id="ob-next-1">Get Started â†’</button>
      </div>

      <!-- â”€â”€ Step 2: Commute mode â”€â”€ -->
      <div class="onboarding-step hidden" id="ob-step-2">
        <div class="step-indicator">
          <span class="step-dot done"></span><span class="step-dot active"></span><span class="step-dot"></span>
          <span class="step-dot"></span><span class="step-dot"></span><span class="step-dot"></span>
        </div>
        <h2>How do you usually commute?</h2>
        <p class="ob-subtitle">Pick your main mode â€” this personalises your tips</p>
        <div class="option-grid" id="ob-commute-options">
          <button class="option-btn" data-value="car">ðŸš—<span>Car (petrol/diesel)</span></button>
          <button class="option-btn" data-value="ev">âš¡<span>Electric vehicle</span></button>
          <button class="option-btn" data-value="motorbike">ðŸ›µ<span>Motorbike/Scooter</span></button>
          <button class="option-btn" data-value="bus">ðŸšŒ<span>Bus</span></button>
          <button class="option-btn" data-value="train">ðŸš†<span>Train/Metro</span></button>
          <button class="option-btn" data-value="bike">ðŸš²<span>Bicycle</span></button>
          <button class="option-btn" data-value="walk">ðŸš¶<span>Walk</span></button>
          <button class="option-btn" data-value="rideshare">ðŸš•<span>Rideshare</span></button>
        </div>
        <div id="ob-car-fuel-wrap" class="hidden">
          <label class="ob-label">Car type:</label>
          <select id="ob-car-fuel" class="ob-select">
            <option value="petrol">Petrol</option>
            <option value="diesel">Diesel</option>
            <option value="hybrid">Hybrid</option>
            <option value="ev">EV</option>
          </select>
        </div>
        <button class="btn-secondary" id="ob-next-2" disabled>Continue â†’</button>
      </div>

      <!-- â”€â”€ Step 3: Diet â”€â”€ -->
      <div class="onboarding-step hidden" id="ob-step-3">
        <div class="step-indicator">
          <span class="step-dot done"></span><span class="step-dot done"></span><span class="step-dot active"></span>
          <span class="step-dot"></span><span class="step-dot"></span><span class="step-dot"></span>
        </div>
        <h2>How would you describe your diet?</h2>
        <p class="ob-subtitle">Used to personalise your food insights and tips</p>
        <div class="option-grid" id="ob-diet-options">
          <button class="option-btn" data-value="meat_heavy">ðŸ¥©<span>Meat most days</span></button>
          <button class="option-btn" data-value="moderate">ðŸ–<span>Meat a few times a week</span></button>
          <button class="option-btn" data-value="vegetarian">ðŸ¥—<span>Vegetarian</span></button>
          <button class="option-btn" data-value="vegan">ðŸŒ±<span>Vegan</span></button>
        </div>
        <button class="btn-secondary" id="ob-next-3" disabled>Continue â†’</button>
      </div>

      <!-- â”€â”€ Step 4: Home energy type â”€â”€ -->
      <div class="onboarding-step hidden" id="ob-step-4">
        <div class="step-indicator">
          <span class="step-dot done"></span><span class="step-dot done"></span><span class="step-dot done"></span>
          <span class="step-dot active"></span><span class="step-dot"></span><span class="step-dot"></span>
        </div>
        <h2>What powers your home?</h2>
        <p class="ob-subtitle">This affects how we calculate your electricity impact</p>
        <div class="option-grid" id="ob-energy-options">
          <button class="option-btn" data-value="grid">ðŸ­<span>Standard grid electricity</span></button>
          <button class="option-btn" data-value="renewable">â˜€ï¸<span>Renewable/green tariff</span></button>
          <button class="option-btn" data-value="unsure">â“<span>Not sure</span></button>
        </div>
        <button class="btn-secondary" id="ob-next-4" disabled>Continue â†’</button>
      </div>

      <!-- â”€â”€ Step 5: Country â”€â”€ NEW â”€â”€-->
      <div class="onboarding-step hidden" id="ob-step-5">
        <div class="step-indicator">
          <span class="step-dot done"></span><span class="step-dot done"></span><span class="step-dot done"></span>
          <span class="step-dot done"></span><span class="step-dot active"></span><span class="step-dot"></span>
        </div>
        <h2>Where do you live?</h2>
        <p class="ob-subtitle">Personalises your electricity factor â€” grids vary enormously by country</p>
        <div class="option-grid country-grid" id="ob-country-options">
          ${countryOptions}
        </div>
        <button class="btn-secondary" id="ob-next-5" disabled>Continue â†’</button>
      </div>

      <!-- â”€â”€ Step 6: Household size â”€â”€ -->
      <div class="onboarding-step hidden" id="ob-step-6">
        <div class="step-indicator">
          <span class="step-dot done"></span><span class="step-dot done"></span><span class="step-dot done"></span>
          <span class="step-dot done"></span><span class="step-dot done"></span><span class="step-dot active"></span>
        </div>
        <h2>How many people share your home?</h2>
        <p class="ob-subtitle">We divide household energy emissions fairly across members</p>
        <div class="household-stepper">
          <button type="button" id="hh-dec" class="stepper-btn-lg">âˆ’</button>
          <span id="hh-count" class="hh-count">1</span>
          <button type="button" id="hh-inc" class="stepper-btn-lg">+</button>
        </div>
        <p class="hh-note">Including yourself</p>
        <button class="btn-primary" id="ob-finish">ðŸŒ Start tracking â†’</button>
      </div>
    </div>
  `;

  _initOnboardingInteractions(overlay, onComplete);
}

/**
 * @description Internal function
 * @internal
 */
function _initOnboardingInteractions(overlay, onComplete) {
  const state = {
    name: "",
    commuteMode: "",
    carFuelType: "petrol",
    dietPattern: "",
    energyType: "",
    country: "world_avg",
    householdSize: 1,
  };

  // Step 1 â†’ 2
  document.getElementById("ob-next-1")?.addEventListener("click", () => {
    state.name = (document.getElementById("ob-name")?.value || "").trim();
    _goto(1, 2);
  });
  document.getElementById("ob-name")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("ob-next-1")?.click();
  });

  // Step 2: commute mode
  _initOptionGrid("ob-commute-options", (val) => {
    state.commuteMode = val;
    document.getElementById("ob-next-2").disabled = false;
    const isCar = ["car", "rideshare"].includes(val);
    document
      .getElementById("ob-car-fuel-wrap")
      .classList.toggle("hidden", !isCar);
  });
  document.getElementById("ob-car-fuel")?.addEventListener("change", (e) => {
    state.carFuelType = e.target.value;
  });
  document
    .getElementById("ob-next-2")
    ?.addEventListener("click", () => _goto(2, 3));

  // Step 3: diet
  _initOptionGrid("ob-diet-options", (val) => {
    state.dietPattern = val;
    document.getElementById("ob-next-3").disabled = false;
  });
  document
    .getElementById("ob-next-3")
    ?.addEventListener("click", () => _goto(3, 4));

  // Step 4: energy type
  _initOptionGrid("ob-energy-options", (val) => {
    state.energyType = val;
    document.getElementById("ob-next-4").disabled = false;
  });
  document
    .getElementById("ob-next-4")
    ?.addEventListener("click", () => _goto(4, 5));

  // Step 5: country
  _initOptionGrid("ob-country-options", (val) => {
    state.country = val;
    document.getElementById("ob-next-5").disabled = false;
  });
  document
    .getElementById("ob-next-5")
    ?.addEventListener("click", () => _goto(5, 6));

  // Step 6: household size
  let hh = 1;
  document.getElementById("hh-inc")?.addEventListener("click", () => {
    hh = Math.min(10, hh + 1);
    document.getElementById("hh-count").textContent = hh;
  });
  document.getElementById("hh-dec")?.addEventListener("click", () => {
    hh = Math.max(1, hh - 1);
    document.getElementById("hh-count").textContent = hh;
  });

  // Finish
  document.getElementById("ob-finish")?.addEventListener("click", () => {
    state.householdSize = hh;
    const profile = { ...state };
    saveProfile(profile);
    markOnboardingComplete();
    overlay.classList.add("hidden");
    onComplete?.(profile);
  });
}

/**
 * @description Internal function
 * @internal
 */
function _goto(from, to) {
  document.getElementById(`ob-step-${from}`)?.classList.add("hidden");
  document.getElementById(`ob-step-${to}`)?.classList.remove("hidden");
}

/**
 * @description Internal function
 * @internal
 */
function _initOptionGrid(gridId, onSelect) {
  const grid = document.getElementById(gridId);
  grid?.querySelectorAll(".option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      grid
        .querySelectorAll(".option-btn")
        .forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      onSelect(btn.dataset.value);
    });
  });
}
