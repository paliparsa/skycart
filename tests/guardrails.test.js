import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../migrations/0001_initial.sql", import.meta.url), "utf8");

test("storefront has product search, cart, and checkout entry points", () => {
  assert.match(html, /id="search-input"/);
  assert.match(html, /id="product-grid"/);
  assert.match(html, /id="cart-open"/);
  assert.match(html, /id="checkout-form"/);
  assert.match(app, /fetch\("\/api\/products\?/);
  assert.match(app, /fetch\("\/api\/orders"/);
});

test("real payment and supplier submission are not enabled by default", () => {
  assert.match(worker, /disabled-until-verified/);
  assert.match(worker, /No payment was collected and no supplier order was placed/);
  assert.match(worker, /liveOrdersEnabled:false/);
});

test("D1 schema stores catalog and pending orders", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS products/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS orders/);
  assert.match(migration, /pending_payment/);
  assert.match(migration, /INSERT OR IGNORE INTO products/);
});
