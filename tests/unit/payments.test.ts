import test from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../../src/shared/core.js";
import { ERROR_KEYS } from "../../src/shared/message-keys.js";
import { PaymentService, type OrderReader, type PaymentProvider } from "../../src/services/payments.service.js";
import type { Order } from "../../src/services/orders.service.js";

const pending:Order={id:"order-1",items:[{productId:"bed",quantity:2,unitPrice:40}],amount:80,currency:"USD",status:"pending",createdAt:new Date(0).toISOString()};
const provider:PaymentProvider={async createSession(payment){return{checkoutUrl:`https://pay.test/${payment.id}`,providerReference:"provider-test"};}};
test("payment service uses the trusted order amount",async()=>{const orders:OrderReader={async get(){return pending;}};const checkout=await new PaymentService(orders,provider).checkout({orderId:pending.id});assert.equal(checkout.amount,80);assert.equal(checkout.orderId,pending.id);});
test("payment service rejects non-pending orders",async()=>{const orders:OrderReader={async get(){return{...pending,status:"paid"};}};await assert.rejects(()=>new PaymentService(orders,provider).checkout({orderId:pending.id}),(error:unknown)=>error instanceof HttpError&&error.key===ERROR_KEYS.orderUnavailable);});
