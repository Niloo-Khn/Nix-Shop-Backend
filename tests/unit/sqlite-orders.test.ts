import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteOrderRepository } from "../../src/repositories/sqlite-order.repository.js";
import type { Order } from "../../src/services/orders.service.js";

test("SQLite order repository saves, reloads, and updates complete orders", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "nix-shop-order-repository-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const repository = new SqliteOrderRepository(join(directory, "orders.sqlite"));
  const order: Order = {
    id: "order-1",
    accountId: "account-1",
    items: [{ productId: "cloud-bed", quantity: 2, unitPrice: 64 }],
    subtotal: 128,
    discount: 12.8,
    shipping: 0,
    amount: 115.2,
    promotionId: "welcome-10",
    currency: "USD",
    status: "pending",
    shippingAddress: "10 Pet Lane",
    createdAt: "2026-09-03T10:00:00.000Z"
  };

  await repository.save(order);
  assert.deepEqual(await repository.find(order.id), order);
  assert.deepEqual(await repository.list(), [order]);

  const paid: Order = { ...order, status: "paid" };
  await repository.save(paid);
  assert.deepEqual(await repository.find(order.id), paid);
});
