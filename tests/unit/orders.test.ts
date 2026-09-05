import test from "node:test";
import assert from "node:assert/strict";
import { HttpError, InMemoryRepository } from "../../src/shared/core.js";
import { ERROR_KEYS } from "../../src/shared/message-keys.js";
import { OrderService, type Order, type ProductCatalog } from "../../src/services/orders.service.js";

const catalog: ProductCatalog = { async get(id) { return { id, price: id === "bed" ? 40 : 5 }; } };
test("order service snapshots trusted prices and calculates totals", async () => { const order = await new OrderService(new InMemoryRepository<Order>(), catalog).create({ items:[{productId:"bed",quantity:2},{productId:"toy",quantity:3}] },"account-1"); assert.equal(order.amount,95); assert.equal(order.accountId,"account-1"); assert.deepEqual(order.items.map(item=>item.unitPrice),[40,5]); });
test("order service retrieves owned order history", async () => { const service=new OrderService(new InMemoryRepository<Order>(),catalog); const created=await service.create({items:[{productId:"toy",quantity:1}]},"account-1");await service.create({items:[{productId:"bed",quantity:1}]},"account-2");assert.deepEqual(await service.getOwned(created.id,"account-1"),created);assert.deepEqual((await service.history("account-1")).orders.map(order=>order.id),[created.id]);await assert.rejects(()=>service.getOwned(created.id,"account-2"),(error:unknown)=>error instanceof HttpError&&error.key===ERROR_KEYS.orderNotFound); });
test("order service rejects invalid quantities", async () => { const service=new OrderService(new InMemoryRepository<Order>(),catalog); await assert.rejects(()=>service.create({items:[{productId:"toy",quantity:0}]},"account-1"),(error:unknown)=>error instanceof HttpError&&error.key===ERROR_KEYS.quantityInvalid); });
