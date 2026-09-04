import test from "node:test";
import assert from "node:assert/strict";
import { createProductApp, type Product } from "./products.js";
import { json, startService } from "./integration-test-helpers.js";
import { ERROR_KEYS } from "./message-keys.js";

test("product API serves catalog and protects writes", async (context) => {
  process.env.ADMIN_API_KEY = "integration-admin-key";
  const service = await startService(createProductApp());
  context.after(() => service.close());
  const catalog = await fetch(`${service.baseUrl}/products`);
  assert.equal(catalog.status, 200);
  assert.equal((await json<Product[]>(catalog)).length, 6);
  const product = await fetch(`${service.baseUrl}/products/cloud-bed`);
  assert.equal((await json<Product>(product)).sku, "NIX-BED-001");
  const unauthorized = await fetch(`${service.baseUrl}/products`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({sku:"NEW-001",price:12}) });
  assert.equal(unauthorized.status, 401);
  assert.equal((await json<{error:{key:string}}>(unauthorized)).error.key, ERROR_KEYS.adminRequired);
  const created = await fetch(`${service.baseUrl}/products`, { method:"POST", headers:{"Content-Type":"application/json","X-Admin-Key":"integration-admin-key"}, body:JSON.stringify({sku:"NEW-001",price:12}) });
  assert.equal(created.status, 201);
  assert.equal((await json<Product>(created)).price, 12);
});
