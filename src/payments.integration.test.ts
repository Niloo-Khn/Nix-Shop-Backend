import test from "node:test";
import assert from "node:assert/strict";
import { createPaymentApp } from "./payments.js";
import { createProductApp } from "./products.js";
import { json, startService } from "./integration-test-helpers.js";
import { ERROR_KEYS } from "./message-keys.js";

test("payment API obtains trusted prices from product API", async (context) => {
  const products = await startService(createProductApp());
  context.after(() => products.close());
  process.env.PRODUCT_SERVICE_URL = products.baseUrl;
  const payments = await startService(createPaymentApp());
  context.after(() => payments.close());
  const response = await fetch(`${payments.baseUrl}/checkout-sessions`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({items:[{productId:"cloud-bed",quantity:2}]}) });
  assert.equal(response.status, 201);
  const checkout = await json<{amount:number;currency:string;providerReference:string}>(response);
  assert.equal(checkout.amount, 136);
  assert.equal(checkout.currency, "USD");
  assert.match(checkout.providerReference, /^dev_/);
  const invalid = await fetch(`${payments.baseUrl}/checkout-sessions`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({items:[{productId:"missing",quantity:1}]}) });
  assert.equal(invalid.status, 400);
  assert.equal((await json<{error:{key:string}}>(invalid)).error.key, ERROR_KEYS.productUnknown);
});
