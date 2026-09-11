import { randomUUID } from "node:crypto";
import { HttpApplication, HttpError, type Json, type Repository, requireFields } from "../shared/core.js";
import { ERROR_KEYS } from "../shared/message-keys.js";
import { SqliteOrderRepository } from "../repositories/sqlite-order.repository.js";

export type OrderItem = { productId: string; quantity: number; unitPrice: number };
export type Order = { id: string; accountId: string; items: OrderItem[]; subtotal: number; discount: number;shipping:number; amount: number; promotionId?: string; currency: "USD"; status: "pending" | "paid" | "cancelled"; shippingAddress:string;createdAt: string };
export type CatalogProduct = { id: string; price: number };
export interface ProductCatalog { get(id: string): Promise<CatalogProduct>; }
export interface PromotionValidator { validate(code: string, amount: number): Promise<{ promotionId: string; discount: number }>; }
export type AccountIdentity={accountId:string;address:string};
export interface AccountVerifier{authenticate(authorization:unknown):Promise<AccountIdentity>;}
export class AccountClient implements AccountVerifier{constructor(private readonly baseUrl=process.env.ACCOUNT_SERVICE_URL??"http://localhost:4001"){}async authenticate(authorization:unknown):Promise<AccountIdentity>{if(typeof authorization!=="string")throw new HttpError(401,ERROR_KEYS.tokenInvalid);const response=await fetch(`${this.baseUrl}/accounts/me`,{headers:{Authorization:authorization}});if(!response.ok)throw new HttpError(401,ERROR_KEYS.tokenInvalid);const account=await response.json() as {id:string;address:string};return{accountId:account.id,address:account.address};}}
export class NoPromotionValidator implements PromotionValidator { async validate(): Promise<{promotionId:string;discount:number}>{return{promotionId:"",discount:0};} }
export class PromotionClient implements PromotionValidator { constructor(private readonly baseUrl=process.env.PROMOTION_SERVICE_URL??"http://localhost:4006"){}async validate(code:string,amount:number){const response=await fetch(`${this.baseUrl}/promotions/validate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,amount})});if(!response.ok)throw new HttpError(response.status,ERROR_KEYS.promotionInvalid);return response.json() as Promise<{promotionId:string;discount:number}>;} }

export class ProductCatalogClient implements ProductCatalog {
  constructor(private readonly baseUrl = process.env.PRODUCT_SERVICE_URL ?? "http://localhost:4002") {}
  async get(id: string): Promise<CatalogProduct> { const response = await fetch(`${this.baseUrl}/products/${encodeURIComponent(id)}`); if (!response.ok) throw new HttpError(400, ERROR_KEYS.productUnknown, { id }); return response.json() as Promise<CatalogProduct>; }
}

export class OrderService {
  constructor(private readonly repository: Repository<Order>, private readonly catalog: ProductCatalog, private readonly promotions: PromotionValidator = new NoPromotionValidator()) {}
  async create(input: unknown, accountId: string, defaultAddress=""): Promise<Order> {
    if (typeof input !== "object" || input === null) throw new HttpError(400, ERROR_KEYS.objectRequired);
    const values = (input as { items?: unknown }).items;
    if (!Array.isArray(values) || values.length < 1 || values.length > 25) throw new HttpError(400, ERROR_KEYS.itemCountInvalid);
    const items: OrderItem[] = []; let amount = 0;
    for (const value of values) { const body = requireFields(value, ["productId"]); const quantity = Number(body.quantity); if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new HttpError(400, ERROR_KEYS.quantityInvalid); const product = await this.catalog.get(String(body.productId)); items.push({ productId: product.id, quantity, unitPrice: product.price }); amount += product.price * quantity; }
    const promotionCode=(input as {promotionCode?:unknown}).promotionCode;const promotion=typeof promotionCode==="string"&&promotionCode.trim()?await this.promotions.validate(promotionCode,amount):undefined;
    const requestedAddress=(input as {shippingAddress?:unknown}).shippingAddress;const shippingAddress=typeof requestedAddress==="string"?requestedAddress.trim().slice(0,500):defaultAddress;
    const discount=promotion?.discount??0;const discounted=Math.max(0,amount-discount);const shipping=discounted>0&&discounted<60?6:0;
    return this.repository.save({ id: randomUUID(), accountId, items, subtotal:amount,discount,shipping,amount:discounted+shipping, ...(promotion?.promotionId?{promotionId:promotion.promotionId}:{}), currency: "USD", status: "pending",shippingAddress, createdAt: new Date().toISOString() });
  }
  async get(id: string): Promise<Order> { const order = await this.repository.find(id); if (!order) throw new HttpError(404, ERROR_KEYS.orderNotFound, { id }); return order; }
  async history(accountId:string,offset=0,limit=10):Promise<{orders:Order[];hasMore:boolean;nextOffset:number}>{const all=(await this.repository.list()).filter((order)=>order.accountId===accountId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));const safeOffset=Math.max(0,offset);const safeLimit=Math.max(1,Math.min(10,limit));return{orders:all.slice(safeOffset,safeOffset+safeLimit),hasMore:all.length>safeOffset+safeLimit,nextOffset:safeOffset+safeLimit};}
  async getOwned(id:string,accountId:string):Promise<Order>{const order=await this.get(id);if(order.accountId!==accountId)throw new HttpError(404,ERROR_KEYS.orderNotFound,{id});return order;}
  async updateStatus(id:string,status:"paid"|"cancelled"):Promise<Order>{const order=await this.get(id);if(order.status===status)return order;if(order.status!=="pending")throw new HttpError(409,ERROR_KEYS.orderUnavailable,{id});return this.repository.save({...order,status});}
}

export function createOrderApp(repository: Repository<Order> = new SqliteOrderRepository()): HttpApplication { const app = new HttpApplication("order-service"); const service = new OrderService(repository, new ProductCatalogClient(),new PromotionClient());const accounts=new AccountClient();const requireService=(key:unknown)=>{if(typeof key!=="string"||!process.env.SERVICE_API_KEY||key!==process.env.SERVICE_API_KEY)throw new HttpError(401,ERROR_KEYS.serviceAuthRequired);};app.route("GET", "/health", async () => ({ body: { service: "orders", status: "ok" } })); app.route("POST", "/orders", async (context) => {const identity=await accounts.authenticate(context.header.authorization);return{status:201,body:await service.create(await context.json(),identity.accountId,identity.address) as unknown as Json};});app.route("GET","/orders",async(context)=>{const identity=await accounts.authenticate(context.header.authorization);return{body:await service.history(identity.accountId,Number(context.query.get("offset")??0),Number(context.query.get("limit")??10)) as unknown as Json};});app.route("PUT","/orders/:id/status",async context=>{requireService(context.header["x-service-key"]);const body=requireFields(await context.json(),["status"]);const status=String(body.status);if(status!=="paid"&&status!=="cancelled")throw new HttpError(400,ERROR_KEYS.orderUnavailable,{id:context.params.id??""});return{body:await service.updateStatus(context.params.id??"",status) as unknown as Json};}); app.route("GET", "/orders/:id", async (context) => {const id=context.params.id??"";const serviceKey=context.header["x-service-key"];if(typeof serviceKey==="string"&&serviceKey===process.env.SERVICE_API_KEY)return{body:await service.get(id) as unknown as Json};return{body:await service.getOwned(id,(await accounts.authenticate(context.header.authorization)).accountId) as unknown as Json};}); return app; }
