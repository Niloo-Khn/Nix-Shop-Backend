import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { HttpApplication, HttpError, type Json, requireFields } from "../shared/core.js";
import { ERROR_KEYS } from "../shared/message-keys.js";
import { SqlitePaymentRepository } from "../repositories/sqlite-payment.repository.js";
import type { Order } from "./orders.service.js";

export type PaymentMethod = "paypal" | "apple_pay" | "klarna" | "card";
export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";
export type Payment = { id:string;orderId:string;accountId:string;idempotencyKey:string;amount:number;currency:"USD";paymentMethod:PaymentMethod;status:PaymentStatus;checkoutUrl:string;providerReference:string;createdAt:string;updatedAt:string };
export interface PaymentRepository { find(id:string):Promise<Payment|undefined>;findByIdempotency(accountId:string,key:string):Promise<Payment|undefined>;findByProviderReference(reference:string):Promise<Payment|undefined>;save(payment:Payment):Promise<Payment>; }
export interface OrderGateway { get(id:string):Promise<Order>;updateStatus(id:string,status:"paid"|"cancelled"):Promise<Order>; }
export interface AccountAuthenticator { authenticate(authorization:unknown):Promise<string>; }
export interface PaymentProvider { createSession(payment:{id:string;order:Order;paymentMethod:PaymentMethod}):Promise<{checkoutUrl:string;providerReference:string}>; }

export class OrderClient implements OrderGateway {
  constructor(private readonly baseUrl=process.env.ORDER_SERVICE_URL??"http://localhost:4005"){}
  async get(id:string):Promise<Order>{const response=await fetch(`${this.baseUrl}/orders/${encodeURIComponent(id)}`,{headers:this.headers()});if(!response.ok)throw new HttpError(400,ERROR_KEYS.orderNotFound,{id});return response.json() as Promise<Order>;}
  async updateStatus(id:string,status:"paid"|"cancelled"):Promise<Order>{const response=await fetch(`${this.baseUrl}/orders/${encodeURIComponent(id)}/status`,{method:"PUT",headers:{...this.headers(),"Content-Type":"application/json"},body:JSON.stringify({status})});if(!response.ok)throw new HttpError(response.status,ERROR_KEYS.orderUnavailable,{id});return response.json() as Promise<Order>;}
  private headers():Record<string,string>{const key=process.env.SERVICE_API_KEY;if(!key)throw new HttpError(503,ERROR_KEYS.serviceAuthRequired);return{"X-Service-Key":key};}
}
export class AccountClient implements AccountAuthenticator {
  constructor(private readonly baseUrl=process.env.ACCOUNT_SERVICE_URL??"http://localhost:4001"){}
  async authenticate(authorization:unknown):Promise<string>{if(typeof authorization!=="string")throw new HttpError(401,ERROR_KEYS.tokenInvalid);const response=await fetch(`${this.baseUrl}/accounts/session`,{headers:{Authorization:authorization}});if(!response.ok)throw new HttpError(401,ERROR_KEYS.tokenInvalid);return((await response.json()) as {accountId:string}).accountId;}
}
export class DevelopmentPaymentProvider implements PaymentProvider {async createSession(payment:{id:string;paymentMethod:PaymentMethod}):Promise<{checkoutUrl:string;providerReference:string}>{return{checkoutUrl:`http://localhost:4173/#/checkout/success?session=${encodeURIComponent(payment.id)}`,providerReference:`dev_${payment.paymentMethod}_${payment.id}`};}}

export class WebhookVerifier {
  constructor(private readonly secret=process.env.PAYMENT_WEBHOOK_SECRET??""){}
  verify(event:{providerReference:string;status:PaymentStatus},signature:unknown):void{if(this.secret.length<32)throw new HttpError(503,ERROR_KEYS.webhookSecretMissing);if(typeof signature!=="string")throw new HttpError(401,ERROR_KEYS.webhookSignatureInvalid);const expected=Buffer.from(this.sign(event),"hex");const received=Buffer.from(signature,"hex");if(expected.length!==received.length||!timingSafeEqual(expected,received))throw new HttpError(401,ERROR_KEYS.webhookSignatureInvalid);}
  sign(event:{providerReference:string;status:PaymentStatus}):string{return createHmac("sha256",this.secret).update(`${event.providerReference}.${event.status}`).digest("hex");}
}

export class PaymentService {
  constructor(private readonly repository:PaymentRepository,private readonly orders:OrderGateway,private readonly provider:PaymentProvider){}
  async checkout(input:unknown,accountId:string,idempotencyKey:unknown):Promise<Payment>{
    const key=validateIdempotencyKey(idempotencyKey);const body=requireFields(input,["orderId","paymentMethod"]);const paymentMethod=String(body.paymentMethod) as PaymentMethod;
    if(!(supportedMethods as readonly string[]).includes(paymentMethod))throw new HttpError(400,ERROR_KEYS.paymentMethodInvalid);
    const orderId=String(body.orderId);const existing=await this.repository.findByIdempotency(accountId,key);
    if(existing){if(existing.orderId!==orderId||existing.paymentMethod!==paymentMethod)throw new HttpError(409,ERROR_KEYS.paymentIdempotencyConflict);return existing;}
    const order=await this.orders.get(orderId);if(order.accountId!==accountId)throw new HttpError(404,ERROR_KEYS.paymentOwnershipInvalid);if(order.status!=="pending")throw new HttpError(409,ERROR_KEYS.orderUnavailable,{id:order.id});
    const id=randomUUID();const session=await this.provider.createSession({id,order,paymentMethod});const now=new Date().toISOString();
    return this.repository.save({id,orderId,accountId,idempotencyKey:key,amount:order.amount,currency:order.currency,paymentMethod,status:"pending",...session,createdAt:now,updatedAt:now});
  }
  async getOwned(id:string,accountId:string):Promise<Payment>{const payment=await this.repository.find(id);if(!payment||payment.accountId!==accountId)throw new HttpError(404,ERROR_KEYS.paymentNotFound);return payment;}
  async processWebhook(input:unknown,signature:unknown,verifier:WebhookVerifier):Promise<Payment>{
    const body=requireFields(input,["providerReference","status"]);const event={providerReference:String(body.providerReference),status:String(body.status) as PaymentStatus};
    if(!(webhookStatuses as readonly string[]).includes(event.status))throw new HttpError(400,ERROR_KEYS.paymentMethodInvalid);verifier.verify(event,signature);
    const payment=await this.repository.findByProviderReference(event.providerReference);if(!payment)throw new HttpError(404,ERROR_KEYS.paymentNotFound);if(payment.status===event.status)return payment;if(payment.status!=="pending")throw new HttpError(409,ERROR_KEYS.orderUnavailable,{id:payment.orderId});
    if(event.status==="paid")await this.orders.updateStatus(payment.orderId,"paid");if(event.status==="cancelled")await this.orders.updateStatus(payment.orderId,"cancelled");return this.repository.save({...payment,status:event.status,updatedAt:new Date().toISOString()});
  }
}
const supportedMethods=["paypal","apple_pay","klarna","card"] as const;const webhookStatuses=["paid","failed","cancelled"] as const;
function validateIdempotencyKey(value:unknown):string{if(typeof value!=="string"||!/^[A-Za-z0-9_-]{8,128}$/.test(value))throw new HttpError(400,ERROR_KEYS.paymentIdempotencyInvalid);return value;}

export function createPaymentApp(repository:PaymentRepository=new SqlitePaymentRepository()):HttpApplication{
  const app=new HttpApplication("payment-service");const service=new PaymentService(repository,new OrderClient(),new DevelopmentPaymentProvider());const accounts=new AccountClient();const verifier=new WebhookVerifier();
  app.route("GET","/health",async()=>({body:{service:"payments",status:"ok"}}));
  app.route("POST","/checkout-sessions",async context=>{const accountId=await accounts.authenticate(context.header.authorization);return{status:201,body:await service.checkout(await context.json(),accountId,context.header["idempotency-key"]) as unknown as Json};});
  app.route("GET","/checkout-sessions/:id",async context=>({body:await service.getOwned(context.params.id??"",await accounts.authenticate(context.header.authorization)) as unknown as Json}));
  app.route("POST","/payment-webhooks/development",async context=>({body:await service.processWebhook(await context.json(),context.header["x-webhook-signature"],verifier) as unknown as Json}));
  return app;
}
