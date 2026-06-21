import test from 'node:test';
import assert from 'node:assert';
// Stub localStorage
global.localStorage = {
  data: {},
  getItem(key) { return this.data[key] || null; },
  setItem(key, value) { this.data[key] = value.toString(); },
  removeItem(key) { delete this.data[key]; },
  clear() { this.data = {}; }
};

import { saveProfile, loadProfile, clearAllData } from '../src/scripts/storage.js';

test('Storage module', async (t) => {
  await t.test('saves and loads profile', () => {
    const profile = { name: 'Test', householdSize: 2 };
    saveProfile(profile);
    const loaded = loadProfile();
    delete loaded.savedAt; assert.deepStrictEqual(loaded, profile);
  });

  await t.test('clears all data', () => {
    clearAllData();
    const loaded = loadProfile();
    assert.strictEqual(loaded, null);
  });
});
