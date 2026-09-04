import test from "node:test";
import assert from "node:assert/strict";
import { HttpError, InMemoryRepository } from "../../src/shared/core.js";
import { ERROR_KEYS } from "../../src/shared/message-keys.js";
import { ProductService, type Product } from "../../src/services/products.service.js";

const records: Product[] = [
  { id: "active", sku: "TEST-001", price: 10, active: true },
  { id: "hidden", sku: "TEST-002", price: 20, active: false }
];

test("product catalog excludes inactive products", async () => {
  const products = await new ProductService(new InMemoryRepository(records)).catalog();
  assert.deepEqual(products.map((product) => product.id), ["active"]);
});

test("product lookup rejects missing and inactive products", async () => {
  const service = new ProductService(new InMemoryRepository(records));
  assert.equal((await service.get("active")).sku, "TEST-001");
  await assert.rejects(() => service.get("hidden"), (error: unknown) => error instanceof HttpError && error.key === ERROR_KEYS.productNotFound);
  await assert.rejects(() => service.get("missing"), (error: unknown) => error instanceof HttpError && error.key === ERROR_KEYS.productNotFound);
});

test("product creation validates price", async () => {
  const service = new ProductService(new InMemoryRepository<Product>());
  const product = await service.create({ sku: "NEW-001", price: 25 });
  assert.equal(product.price, 25);
  assert.equal(product.active, true);
  await assert.rejects(() => service.create({ sku: "BAD-001", price: -1 }), (error: unknown) => error instanceof HttpError && error.key === ERROR_KEYS.priceInvalid);
});
