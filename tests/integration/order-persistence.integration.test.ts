import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createProductApp } from "../../src/services/products.service.js";
import { createOrderApp, type Order } from "../../src/services/orders.service.js";
import { SqliteOrderRepository } from "../../src/repositories/sqlite-order.repository.js";
import { json, startAuthenticatedAccount, startService } from "./helpers.js";

test("order database survives an order-service restart", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "nix-shop-orders-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const databasePath = join(directory, "orders.sqlite");
  const account = await startAuthenticatedAccount();
  context.after(() => account.service.close());
  const products = await startService(createProductApp());
  context.after(() => products.close());
  process.env.ACCOUNT_SERVICE_URL = account.service.baseUrl;
  process.env.PRODUCT_SERVICE_URL = products.baseUrl;

  const first = await startService(createOrderApp(new SqliteOrderRepository(databasePath)));
  const response = await fetch(`${first.baseUrl}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: account.authorization },
    body: JSON.stringify({ items: [{ productId: "cloud-bed", quantity: 1 }], shippingAddress: "10 Pet Lane" })
  });
  assert.equal(response.status, 201);
  const created = await json<Order>(response);
  await first.close();

  const second = await startService(createOrderApp(new SqliteOrderRepository(databasePath)));
  context.after(() => second.close());
  const historyResponse = await fetch(`${second.baseUrl}/orders`, { headers: { Authorization: account.authorization } });
  assert.equal(historyResponse.status, 200);
  const history = await json<{ orders: Order[] }>(historyResponse);
  assert.equal(history.orders.length, 1);
  assert.deepEqual(history.orders[0], created);
});
