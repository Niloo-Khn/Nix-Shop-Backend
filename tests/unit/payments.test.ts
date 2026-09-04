import test from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../../src/shared/core.js";
import { ERROR_KEYS } from "../../src/shared/message-keys.js";
import { PaymentService, type PaymentProvider, type ProductCatalog } from "../../src/services/payments.service.js";

const catalog: ProductCatalog = { async get(id) { return { id, price: id === "bed" ? 40 : 5 }; } };
const provider: PaymentProvider = { async createSession(order) { return { checkoutUrl: `https://pay.test/${order.id}`, providerReference: "provider-test" }; } };

test("payment service recalculates totals from trusted catalog prices", async () => {
  const checkout = await new PaymentService(catalog, provider).checkout({ items: [{ productId: "bed", quantity: 2 }, { productId: "toy", quantity: 3 }] });
  assert.equal(checkout.amount, 95);
  assert.equal(checkout.currency, "USD");
  assert.equal(checkout.providerReference, "provider-test");
});

test("payment service rejects empty orders and invalid quantities", async () => {
  const service = new PaymentService(catalog, provider);
  await assert.rejects(() => service.checkout({ items: [] }), (error: unknown) => error instanceof HttpError && error.key === ERROR_KEYS.itemCountInvalid);
  await assert.rejects(() => service.checkout({ items: [{ productId: "bed", quantity: 11 }] }), (error: unknown) => error instanceof HttpError && error.key === ERROR_KEYS.quantityInvalid);
});
