"use strict";
/**
 * simulator.js
 * ============
 * Interactive "What If?" scenario simulator.
 * Lets users see the annual COâ‚‚e savings from potential behaviour changes.
 * All calculations use the same emission factors as the main logger â€” fully auditable.
 */

import { EMISSION_FACTORS, getTransportFactor } from '../data/emissionFactors.js';
import { loadRecentLogs } from './storage.js';

// â”€â”€â”€ Baseline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Computes the daily baseline footprint for the user.
 * Averages recent logs if available, otherwise falls back to global average.
 * @param {Object} profile - The user's baseline profile
 * @returns {Object} An object containing transport, food, energy, consumption, total, and source description
 */
function _getDailyBaseline(profile) {
  const logs = loadRecentLogs(30);
  if (logs.length >= 3) {
    const n = logs.length;
    return {
      transport:   logs.reduce((s, l) => s + (l.totals?.transport   || 0), 0) / n,
      food:        logs.reduce((s, l) => s + (l.totals?.food        || 0), 0) / n,
      energy:      logs.reduce((s, l) => s + (l.totals?.energy      || 0), 0) / n,
      consumption: logs.reduce((s, l) => s + (l.totals?.consumption || 0), 0) / n,
      total:       logs.reduce((s, l) => s + (l.totals?.total       || 0), 0) / n,
      source: `your last ${n} logged days`,
    };
  }
  const g = EMISSION_FACTORS.baselines.global_avg_daily_kg;
  return {
    transport:   g * 0.27, food: g * 0.26, energy: g * 0.32, consumption: g * 0.15, total: g,
    source: 'global average (log more days for your personalised figure)',
  };
}

// â”€â”€â”€ Main render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Renders the What-If Simulator view, building sliders and interactive elements.
 * @param {Object} profile - The user's baseline profile containing country and household size
 */
export function renderSimulator(profile) {
  const section = document.getElementById('simulator-section');
  if (!section) return;

  const daily = _getDailyBaseline(profile);
  const annual = {
    transport:   daily.transport   * 365,
    food:        daily.food        * 365,
    energy:      daily.energy      * 365,
    consumption: daily.consumption * 365,
    total:       daily.total       * 365,
  };

  // Country-aware grid intensity for energy scenario
  const country    = profile?.country || 'world_avg';
  const gridData   = EMISSION_FACTORS.gridIntensityByCountry?.[country];
  const gridFactor = gridData?.kg ?? EMISSION_FACTORS.energy.electricity_grid;
  const renewFactor= EMISSION_FACTORS.energy.electricity_renewable;
  const hhSize     = Math.max(1, profile?.householdSize || 1);
  const annualKwh  = (EMISSION_FACTORS.energy.typical_home_daily_kwh * 365) / hhSize;
  const energySaving = Math.max(0, (gridFactor - renewFactor) * annualKwh);

  section.innerHTML = `
    <div class="simulator-wrapper">

      <!-- Baseline summary -->
      <div class="sim-baseline-card glass-card">
        <div class="sim-baseline-header">
          <div>
            <h3 class="sim-baseline-title">ðŸ“Š Your estimated annual footprint</h3>
            <p class="sim-baseline-source">Based on ${daily.source}</p>
          </div>
          <div class="sim-baseline-total">
            <span class="sim-big-num">${annual.total.toFixed(0)}</span>
            <span class="sim-big-unit">kg COâ‚‚e / year</span>
          </div>
        </div>
        <div class="sim-cat-row">
          <div class="sim-cat-chip" style="--cat-color:#4ecdc4"><span>ðŸš—</span><strong>${annual.transport.toFixed(0)} kg</strong><small>Transport</small></div>
          <div class="sim-cat-chip" style="--cat-color:#ffd93d"><span>ðŸ½ï¸</span><strong>${annual.food.toFixed(0)} kg</strong><small>Food</small></div>
          <div class="sim-cat-chip" style="--cat-color:#ff6b6b"><span>âš¡</span><strong>${annual.energy.toFixed(0)} kg</strong><small>Energy</small></div>
          <div class="sim-cat-chip" style="--cat-color:#a78bfa"><span>ðŸ›ï¸</span><strong>${annual.consumption.toFixed(0)} kg</strong><small>Shopping</small></div>
        </div>
      </div>

      <h3 class="sim-scenarios-heading">ðŸ”® What if you changed these habits?</h3>
      <p class="sim-scenarios-sub">Adjust each slider to see your potential annual COâ‚‚e savings</p>

      <div class="sim-scenarios-grid">

        <!-- Diet -->
        <div class="sim-scenario-card glass-card">
          <div class="sim-scenario-top">
            <span class="sim-scenario-emoji">ðŸ¥¦</span>
            <div>
              <h4 class="sim-scenario-title">Replace meat meals with plant-based</h4>
              <p class="sim-scenario-sub-text">Each beefâ†’vegan swap saves <strong>5.6 kg COâ‚‚e</strong> per meal</p>
            </div>
          </div>
          <div class="sim-control">
            <label class="sim-slider-label">Swap <span class="sim-val" id="diet-val">3</span> meat meals/week</label>
            <input type="range" class="sim-slider" id="diet-slider" min="0" max="21" step="1" value="3" aria-label="Meat meals to swap per week">
            <div class="sim-slider-ticks" aria-hidden="true"><span>0</span><span>7</span><span>14</span><span>21</span></div>
          </div>
          <div class="sim-saving-box">
            <span class="sim-saving-num" id="diet-saving">874</span>
            <span class="sim-saving-unit">kg COâ‚‚e saved / year</span>
          </div>
          <p class="sim-equiv" id="diet-equiv"></p>
        </div>

        <!-- WFH -->
        <div class="sim-scenario-card glass-card">
          <div class="sim-scenario-top">
            <span class="sim-scenario-emoji">ðŸ </span>
            <div>
              <h4 class="sim-scenario-title">Work from home more often</h4>
              <p class="sim-scenario-sub-text">Skipping your commute eliminates that day's transport emissions</p>
            </div>
          </div>
          <div class="sim-control">
            <label class="sim-slider-label"><span class="sim-val" id="wfh-val">1</span> WFH day(s) per week</label>
            <input type="range" class="sim-slider" id="wfh-slider" min="0" max="5" step="1" value="1" aria-label="Work from home days per week">
            <div class="sim-slider-ticks" aria-hidden="true"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
          </div>
          <div class="sim-saving-box">
            <span class="sim-saving-num" id="wfh-saving">0</span>
            <span class="sim-saving-unit">kg COâ‚‚e saved / year</span>
          </div>
          <p class="sim-equiv" id="wfh-equiv"></p>
        </div>

        <!-- Transport switch -->
        <div class="sim-scenario-card glass-card">
          <div class="sim-scenario-top">
            <span class="sim-scenario-emoji">âš¡</span>
            <div>
              <h4 class="sim-scenario-title">Switch car trips to greener transport</h4>
              <p class="sim-scenario-sub-text">Replace a portion of petrol/diesel journeys with cleaner alternatives</p>
            </div>
          </div>
          <div class="sim-control">
            <div class="sim-control-row-inline">
              <label class="sim-slider-label">Switch <span class="sim-val" id="transport-val">30</span>% to</label>
              <select id="transport-target" class="sim-select" aria-label="Target transport mode">
                <option value="ev">âš¡ EV (0.047 kg/km)</option>
                <option value="bus">ðŸšŒ Bus (0.089 kg/km)</option>
                <option value="train">ðŸš† Train (0.035 kg/km)</option>
                <option value="bike">ðŸš² Cycling (0 kg/km)</option>
              </select>
            </div>
            <input type="range" class="sim-slider" id="transport-slider" min="0" max="100" step="10" value="30" aria-label="Percentage of car trips to switch">
            <div class="sim-slider-ticks" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>
          </div>
          <div class="sim-saving-box">
            <span class="sim-saving-num" id="transport-saving">0</span>
            <span class="sim-saving-unit">kg COâ‚‚e saved / year</span>
          </div>
          <p class="sim-equiv" id="transport-equiv"></p>
        </div>

        <!-- Renewable energy -->
        <div class="sim-scenario-card glass-card">
          <div class="sim-scenario-top">
            <span class="sim-scenario-emoji">â˜€ï¸</span>
            <div>
              <h4 class="sim-scenario-title">Switch to renewable electricity</h4>
              <p class="sim-scenario-sub-text">
                Your grid (${gridData?.label ?? 'world avg'}): <strong>${gridFactor.toFixed(3)} kg/kWh</strong> â†’
                Renewable: <strong>${renewFactor} kg/kWh</strong>
              </p>
            </div>
          </div>
          <div class="sim-control">
            <div class="sim-energy-toggle" role="group" aria-label="Energy source toggle">
              <button class="sim-toggle-btn active" id="energy-grid-btn" aria-pressed="true">ðŸ“ Currently on grid</button>
              <button class="sim-toggle-btn" id="energy-renew-btn" aria-pressed="false">â†’ Switch to renewable</button>
            </div>
          </div>
          <div class="sim-saving-box">
            <span class="sim-saving-num" id="energy-saving">0</span>
            <span class="sim-saving-unit">kg COâ‚‚e saved / year</span>
          </div>
          <p class="sim-equiv" id="energy-equiv">Toggle to renewable above to see your potential saving</p>
        </div>

        <!-- Deliveries -->
        <div class="sim-scenario-card glass-card">
          <div class="sim-scenario-top">
            <span class="sim-scenario-emoji">ðŸ“¦</span>
            <div>
              <h4 class="sim-scenario-title">Bundle online deliveries</h4>
              <p class="sim-scenario-sub-text">Consolidating orders cuts last-mile trips (~0.5 kg COâ‚‚e per parcel)</p>
            </div>
          </div>
          <div class="sim-control">
            <label class="sim-slider-label">Reduce delivery frequency by <span class="sim-val" id="delivery-val">40</span>%</label>
            <input type="range" class="sim-slider" id="delivery-slider" min="0" max="80" step="10" value="40" aria-label="Percentage to reduce delivery frequency">
            <div class="sim-slider-ticks" aria-hidden="true"><span>0%</span><span>40%</span><span>80%</span></div>
          </div>
          <div class="sim-saving-box">
            <span class="sim-saving-num" id="delivery-saving">0</span>
            <span class="sim-saving-unit">kg COâ‚‚e saved / year</span>
          </div>
          <p class="sim-equiv" id="delivery-equiv"></p>
        </div>

      </div>

      <!-- Grand total -->
      <div class="sim-total-card glass-card">
        <div class="sim-total-row">
          <div>
            <h3 class="sim-total-title">ðŸŽ¯ Combined potential annual saving</h3>
            <p class="sim-total-sub">If you made all the changes above simultaneously</p>
          </div>
          <div class="sim-total-right">
            <span class="sim-total-num" id="sim-grand-total">0</span>
            <span class="sim-total-unit">kg COâ‚‚e / year</span>
          </div>
        </div>
        <div class="sim-total-bar-track">
          <div class="sim-total-bar-fill" id="sim-total-bar" style="width:0%"></div>
        </div>
        <div class="sim-total-bar-labels">
          <span>0</span>
          <span>of ${annual.total.toFixed(0)} kg annual footprint</span>
        </div>
        <p class="sim-total-note" id="sim-total-note">Adjust the scenarios above to see your potential impact.</p>
      </div>

    </div>
  `;

  _initSimulatorEvents(annual, energySaving);
}

// â”€â”€â”€ Event wiring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Initialises event listeners and dynamic updates for the simulator controls.
 * @param {Object} annual - The computed annual baseline footprint object
 * @param {number} energySaving - Pre-computed energy saving for switching to renewable
 */
function _initSimulatorEvents(annual, energySaving) {
  const savings = { diet: 0, wfh: 0, transport: 0, energy: 0, delivery: 0 };

  function _setEquiv(id, kg) {
    const el = document.getElementById(id);
    if (!el) return;
    if (kg <= 0) { el.textContent = ''; return; }
    const km   = (kg * EMISSION_FACTORS.baselines.car_km_per_kg_co2).toFixed(0);
    const trees = Math.round(kg / EMISSION_FACTORS.baselines.tree_offset_kg_year);
    el.textContent = `â‰ˆ not driving ${km} km Â· like ${trees} tree${trees !== 1 ? 's' : ''} absorbing for a year`;
  }

  function _updateTotal() {
    const total = Object.values(savings).reduce((s, v) => s + v, 0);
    const el    = document.getElementById('sim-grand-total');
    const barEl = document.getElementById('sim-total-bar');
    const noteEl= document.getElementById('sim-total-note');
    if (el) el.textContent = total.toFixed(0);
    if (barEl) barEl.style.width = annual.total > 0 ? Math.min(100, (total / annual.total) * 100) + '%' : '0%';
    if (noteEl && total > 0) {
      const pct   = ((total / annual.total) * 100).toFixed(0);
      const trees = Math.round(total / EMISSION_FACTORS.baselines.tree_offset_kg_year);
      noteEl.textContent = `That's a ${pct}% reduction from your estimated footprint â€” like planting ${trees} trees ðŸŒ³`;
    }
  }

  // â”€â”€ Diet slider â”€â”€
  document.getElementById('diet-slider')?.addEventListener('input', e => {
    const meals = +e.target.value;
    document.getElementById('diet-val').textContent = meals;
    savings.diet = meals * 52 * (EMISSION_FACTORS.food.meal_beef - EMISSION_FACTORS.food.meal_vegan);
    document.getElementById('diet-saving').textContent = savings.diet.toFixed(0);
    _setEquiv('diet-equiv', savings.diet);
    _updateTotal();
  });
  document.getElementById('diet-slider')?.dispatchEvent(new Event('input'));

  // â”€â”€ WFH slider â”€â”€
  document.getElementById('wfh-slider')?.addEventListener('input', e => {
    const days = +e.target.value;
    document.getElementById('wfh-val').textContent = days;
    // Commute â‰ˆ 1/5 of weekly transport; cap at annual total
    savings.wfh = Math.min(annual.transport, (annual.transport / 5) * days);
    document.getElementById('wfh-saving').textContent = savings.wfh.toFixed(0);
    _setEquiv('wfh-equiv', savings.wfh);
    _updateTotal();
  });
  document.getElementById('wfh-slider')?.dispatchEvent(new Event('input'));

  // â”€â”€ Transport switch slider + select â”€â”€
  function _calcTransportSaving() {
    const pct        = +(document.getElementById('transport-slider')?.value || 0) / 100;
    const targetMode = document.getElementById('transport-target')?.value || 'ev';
    document.getElementById('transport-val').textContent = Math.round(pct * 100);
    const oldFactor  = getTransportFactor('car', 'petrol');
    const newFactor  = getTransportFactor(targetMode);
    const reduction  = oldFactor > 0 ? Math.max(0, 1 - newFactor / oldFactor) : 0;
    savings.transport = annual.transport * pct * reduction;
    document.getElementById('transport-saving').textContent = savings.transport.toFixed(0);
    _setEquiv('transport-equiv', savings.transport);
    _updateTotal();
  }
  document.getElementById('transport-slider')?.addEventListener('input', _calcTransportSaving);
  document.getElementById('transport-target')?.addEventListener('change', _calcTransportSaving);
  _calcTransportSaving();

  // â”€â”€ Energy toggle â”€â”€
  document.getElementById('energy-renew-btn')?.addEventListener('click', () => {
    document.getElementById('energy-renew-btn')?.classList.add('active');
    document.getElementById('energy-renew-btn')?.setAttribute('aria-pressed', 'true');
    document.getElementById('energy-grid-btn')?.classList.remove('active');
    document.getElementById('energy-grid-btn')?.setAttribute('aria-pressed', 'false');
    savings.energy = energySaving;
    document.getElementById('energy-saving').textContent = energySaving.toFixed(0);
    _setEquiv('energy-equiv', energySaving);
    _updateTotal();
  });
  document.getElementById('energy-grid-btn')?.addEventListener('click', () => {
    document.getElementById('energy-grid-btn')?.classList.add('active');
    document.getElementById('energy-grid-btn')?.setAttribute('aria-pressed', 'true');
    document.getElementById('energy-renew-btn')?.classList.remove('active');
    document.getElementById('energy-renew-btn')?.setAttribute('aria-pressed', 'false');
    savings.energy = 0;
    document.getElementById('energy-saving').textContent = '0';
    document.getElementById('energy-equiv').textContent = 'Toggle to renewable above to see your potential saving';
    _updateTotal();
  });

  // â”€â”€ Delivery slider â”€â”€
  document.getElementById('delivery-slider')?.addEventListener('input', e => {
    const pct = +e.target.value / 100;
    document.getElementById('delivery-val').textContent = e.target.value;
    savings.delivery = annual.consumption * pct;
    document.getElementById('delivery-saving').textContent = savings.delivery.toFixed(0);
    _setEquiv('delivery-equiv', savings.delivery);
    _updateTotal();
  });
  document.getElementById('delivery-slider')?.dispatchEvent(new Event('input'));
}

