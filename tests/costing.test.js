import test from 'node:test';
import assert from 'node:assert/strict';
import { landed, cost, margin, fifo, products, baseline } from '../dist/costing.js';

test('12% supplier price increase yields expected landed cost and loss-making product B at baseline FX 96', () => {
  const r = landed(2.24, 96, 10, 10);
  assert.ok(Math.abs(r - 247.544) < 1e-9);
  assert.ok(margin(products[1], r) < 0);
  assert.ok(margin(products[0], r) > 0);
});

test('scrap is applied as yield loss', () => {
  assert.ok(Math.abs(cost(products[0], 222.2) - 38.38947368421) < 1e-9);
});

test('FIFO preserves original cost and splits issue between batches', () => {
  const v = fifo(120, 247.544);
  assert.equal(v.old, 100);
  assert.equal(v.fresh, 20);
  assert.ok(Math.abs(v.total - 27170.88) < 1e-8);
  assert.throws(() => fifo(301, 247.544));
});
