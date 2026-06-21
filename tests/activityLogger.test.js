import test from 'node:test';
import assert from 'node:assert';
import { calcTransportEmissions, calcFoodEmissions, calcEnergyEmissions, calcConsumptionEmissions } from '../src/scripts/activityLogger.js';

test('Transport Emissions Calculation', async (t) => {
  await t.test('calculates correct car transport with distance', () => {
    const res = calcTransportEmissions('car', 'petrol', 10, 0, 0);
    assert.strictEqual(res, 1.7);
  });

  await t.test('calculates flights correctly', () => {
    // 1 short flight (0.255 kg/km) * 500 = 127.5
    // 1 long flight (0.195 kg/km) * 2000 = 390
    const res = calcTransportEmissions('train', null, 0, 500, 2000);
    assert.strictEqual(res, 517.5);
  });

  await t.test('handles negative inputs gracefully', () => {
    const res = calcTransportEmissions('car', 'petrol', -10, -50, -100);
    assert.strictEqual(res, 0);
  });
});

test('Food Emissions Calculation', async (t) => {
  await t.test('calculates meal mix correctly', () => {
    const res = calcFoodEmissions(1, 1, 1, 1, 0);
    // 6.0 + 1.8 + 0.7 + 0.4 = 8.9
    assert.strictEqual(res, 8.9);
  });

  await t.test('adds delivery overhead', () => {
    const res = calcFoodEmissions(0, 0, 0, 0, 2);
    // 2 * 0.7 = 1.4
    assert.strictEqual(res, 1.4);
  });
});

test('Energy Emissions Calculation', async (t) => {
  await t.test('uses world average if no country specified', () => {
    const res = calcEnergyEmissions(0, 10, 'grid', 1, null);
    // 10 * 0.436 = 4.36
    assert.strictEqual(res, 4.36);
  });

  await t.test('uses country-specific grid factor (India)', () => {
    const res = calcEnergyEmissions(0, 10, 'grid', 1, 'india');
    // 10 * 0.708 = 7.08
    assert.strictEqual(res, 7.08);
  });

  await t.test('divides by household size', () => {
    const res = calcEnergyEmissions(0, 10, 'grid', 2, null);
    // (10 * 0.436) / 2 = 2.18
    assert.strictEqual(res, 2.18);
  });
});

test('Consumption Emissions Calculation', async (t) => {
  await t.test('calculates typical consumption', () => {
    const res = calcConsumptionEmissions(2, 1, 1);
    // 2*0.5 + 1*20 + 1*30 = 51
    assert.strictEqual(res, 51);
  });
});
