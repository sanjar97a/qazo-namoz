import test from 'node:test';
import assert from 'node:assert/strict';
import { widgetData } from '../widget.js';

test('Vidjet: 31 kunlik vaqtlar, tartib to‘g‘ri', () => {
  const s = { city: 'Namangan, Uzbekistan', lat: 40.9983, lng: 71.6726, method: 'uzbekistan', madhab: 'hanafi', offsets: {} };
  const d = widgetData(s, new Date(2026, 9, 23, 10));
  assert.equal(d.city, 'Namangan');
  assert.equal(Object.keys(d.days).length, 31);
  const t = d.days['2026-10-23'];
  assert.equal(t.length, 6);
  for (let i = 1; i < 6; i++) assert.ok(t[i] > t[i - 1]);
  assert.ok(d.days['2026-10-22'] && d.days['2026-11-21']);
});
