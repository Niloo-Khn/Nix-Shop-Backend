import test from "node:test";
import assert from "node:assert/strict";
import { PasswordHasher } from "./accounts.js";
import { InMemoryRepository } from "./core.js";
import { ProductService, type Product } from "./products.js";

test("passwords are salted and verifiable", async () => {
  const hasher = new PasswordHasher();
  const first = await hasher.hash("long-test-password");
  const second = await hasher.hash("long-test-password");
  assert.notEqual(first, second);
  assert.equal(await hasher.verify("long-test-password", first), true);
  assert.equal(await hasher.verify("wrong-password", first), false);
});

test("product service only returns active products", async () => {
  const repository = new InMemoryRepository<Product>([
    { id: "active", name: "Active", category: "Cats", price: 10, description: "Active", icon: "🐈", color: "#fff", active: true },
    { id: "hidden", name: "Hidden", category: "Cats", price: 10, description: "Hidden", icon: "🐈", color: "#fff", active: false }
  ]);
  const products = await new ProductService(repository).catalog();
  assert.deepEqual(products.map((product) => product.id), ["active"]);
});
