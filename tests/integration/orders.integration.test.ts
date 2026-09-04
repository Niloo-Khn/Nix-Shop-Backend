import test from "node:test";
import assert from "node:assert/strict";
import { createProductApp } from "../../src/services/products.service.js";
import { createOrderApp, type Order } from "../../src/services/orders.service.js";
import { json, startService } from "./helpers.js";

test("order API obtains trusted prices from product API",async(context)=>{const products=await startService(createProductApp());context.after(()=>products.close());process.env.PRODUCT_SERVICE_URL=products.baseUrl;const orders=await startService(createOrderApp());context.after(()=>orders.close());const response=await fetch(`${orders.baseUrl}/orders`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:[{productId:"cloud-bed",quantity:2}]})});assert.equal(response.status,201);const order=await json<Order>(response);assert.equal(order.amount,136);assert.equal(order.items[0]?.unitPrice,68);const fetched=await fetch(`${orders.baseUrl}/orders/${order.id}`);assert.deepEqual(await json<Order>(fetched),order);});
