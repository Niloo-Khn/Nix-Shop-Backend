import { randomUUID } from "node:crypto";
import { HttpApplication, HttpError, type Json, requireFields } from "../shared/core.js";
import { ERROR_KEYS } from "../shared/message-keys.js";
import type { Order } from "./orders.service.js";

export interface OrderReader { get(id: string): Promise<Order>; }
export type PaymentMethod="paypal"|"apple_pay"|"klarna"|"card";
export interface PaymentProvider { createSession(payment: { id: string; order: Order;paymentMethod:PaymentMethod }): Promise<{ checkoutUrl: string; providerReference: string }>; }

export class OrderClient implements OrderReader {
  constructor(private readonly baseUrl = process.env.ORDER_SERVICE_URL ?? "http://localhost:4005") {}
  async get(id: string): Promise<Order> { const serviceKey=process.env.SERVICE_API_KEY;if(!serviceKey)throw new HttpError(503,ERROR_KEYS.serviceAuthRequired);const response = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(id)}`,{headers:{"X-Service-Key":serviceKey}}); if (!response.ok) throw new HttpError(400, ERROR_KEYS.orderNotFound, { id }); return response.json() as Promise<Order>; }
}
export class DevelopmentPaymentProvider implements PaymentProvider {
  async createSession(payment: { id: string;paymentMethod:PaymentMethod }): Promise<{ checkoutUrl: string; providerReference: string }> { return { checkoutUrl: `http://localhost:4173/#/checkout/success?session=${encodeURIComponent(payment.id)}`, providerReference: `dev_${payment.paymentMethod}_${payment.id}` }; }
}
export class PaymentService {
  constructor(private readonly orders: OrderReader, private readonly provider: PaymentProvider) {}
  async checkout(input: unknown) { const body = requireFields(input, ["orderId","paymentMethod"]);const paymentMethod=String(body.paymentMethod) as PaymentMethod;if(!(["paypal","apple_pay","klarna","card"] as string[]).includes(paymentMethod))throw new HttpError(400,ERROR_KEYS.paymentMethodInvalid); const order = await this.orders.get(String(body.orderId)); if (order.status !== "pending") throw new HttpError(409, ERROR_KEYS.orderUnavailable, { id: order.id }); const id = randomUUID(); const session = await this.provider.createSession({ id, order,paymentMethod }); return { id, orderId: order.id, amount: order.amount, currency: order.currency,paymentMethod, ...session }; }
}
export function createPaymentApp(): HttpApplication { const app = new HttpApplication("payment-service"); const service = new PaymentService(new OrderClient(), new DevelopmentPaymentProvider()); app.route("GET", "/health", async () => ({ body: { service: "payments", status: "ok" } })); app.route("POST", "/checkout-sessions", async (context) => ({ status: 201, body: await service.checkout(await context.json()) as Json })); return app; }
