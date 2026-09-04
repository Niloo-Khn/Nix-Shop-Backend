import test from "node:test";
import assert from "node:assert/strict";
import { HttpError, InMemoryRepository } from "../../src/shared/core.js";
import { ERROR_KEYS } from "../../src/shared/message-keys.js";
import { OrderService, type Order, type ProductCatalog } from "../../src/services/orders.service.js";

const catalog: ProductCatalog = { async get(id) { return { id, price: id === "bed" ? 40 : 5 }; } };
test("order service snapshots trusted prices and calculates totals", async () => { const order = await new OrderService(new InMemoryRepository<Order>(), catalog).create({ items:[{productId:"bed",quantity:2},{productId:"toy",quantity:3}] }); assert.equal(order.amount,95); assert.equal(order.status,"pending"); assert.deepEqual(order.items.map(item=>item.unitPrice),[40,5]); });
test("order service retrieves orders and rejects missing IDs", async () => { const service=new OrderService(new InMemoryRepository<Order>(),catalog); const created=await service.create({items:[{productId:"toy",quantity:1}]}); assert.deepEqual(await service.get(created.id),created); await assert.rejects(()=>service.get("missing"),(error:unknown)=>error instanceof HttpError&&error.key===ERROR_KEYS.orderNotFound); });
test("order service rejects invalid quantities", async () => { const service=new OrderService(new InMemoryRepository<Order>(),catalog); await assert.rejects(()=>service.create({items:[{productId:"toy",quantity:0}]}),(error:unknown)=>error instanceof HttpError&&error.key===ERROR_KEYS.quantityInvalid); });
