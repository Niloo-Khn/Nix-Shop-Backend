import test from "node:test";
import assert from "node:assert/strict";
import { createProductApp } from "../../src/services/products.service.js";
import { createOrderApp, type Order } from "../../src/services/orders.service.js";
import { createPromotionApp } from "../../src/services/promotions.service.js";
import { json, startService } from "./helpers.js";

test("order API applies promotion API discounts to trusted product prices",async(context)=>{const products=await startService(createProductApp());context.after(()=>products.close());const promotions=await startService(createPromotionApp());context.after(()=>promotions.close());process.env.PRODUCT_SERVICE_URL=products.baseUrl;process.env.PROMOTION_SERVICE_URL=promotions.baseUrl;const orders=await startService(createOrderApp());context.after(()=>orders.close());const response=await fetch(`${orders.baseUrl}/orders`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:[{productId:"cloud-bed",quantity:2}],promotionCode:"WELCOME10"})});assert.equal(response.status,201);const order=await json<Order>(response);assert.equal(order.subtotal,136);assert.equal(order.discount,13.6);assert.equal(order.amount,122.4);assert.equal(order.promotionId,"welcome-10");assert.equal(order.items[0]?.unitPrice,68);const fetched=await fetch(`${orders.baseUrl}/orders/${order.id}`);assert.deepEqual(await json<Order>(fetched),order);});
