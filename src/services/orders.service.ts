import { randomUUID } from "node:crypto";
import { HttpApplication, HttpError, InMemoryRepository, type Json, type Repository, requireFields } from "../shared/core.js";
import { ERROR_KEYS } from "../shared/message-keys.js";

export type OrderItem = { productId: string; quantity: number; unitPrice: number };
export type Order = { id: string; accountId: string; items: OrderItem[]; subtotal: number; discount: number; amount: number; promotionId?: string; currency: "USD"; status: "pending" | "paid" | "cancelled"; createdAt: string };
export type CatalogProduct = { id: string; price: number };
export interface ProductCatalog { get(id: string): Promise<CatalogProduct>; }
export interface PromotionValidator { validate(code: string, amount: number): Promise<{ promotionId: string; discount: number }>; }
export interface AccountVerifier{authenticate(authorization:unknown):Promise<string>;}
export class AccountClient implements AccountVerifier{constructor(private readonly baseUrl=process.env.ACCOUNT_SERVICE_URL??"http://localhost:4001"){}async authenticate(authorization:unknown):Promise<string>{if(typeof authorization!=="string")throw new HttpError(401,ERROR_KEYS.tokenInvalid);const response=await fetch(`${this.baseUrl}/accounts/session`,{headers:{Authorization:authorization}});if(!response.ok)throw new HttpError(401,ERROR_KEYS.tokenInvalid);return((await response.json()) as {accountId:string}).accountId;}}
export class NoPromotionValidator implements PromotionValidator { async validate(): Promise<{promotionId:string;discount:number}>{return{promotionId:"",discount:0};} }
export class PromotionClient implements PromotionValidator { constructor(private readonly baseUrl=process.env.PROMOTION_SERVICE_URL??"http://localhost:4006"){}async validate(code:string,amount:number){const response=await fetch(`${this.baseUrl}/promotions/validate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,amount})});if(!response.ok)throw new HttpError(response.status,ERROR_KEYS.promotionInvalid);return response.json() as Promise<{promotionId:string;discount:number}>;} }

export class ProductCatalogClient implements ProductCatalog {
  constructor(private readonly baseUrl = process.env.PRODUCT_SERVICE_URL ?? "http://localhost:4002") {}
  async get(id: string): Promise<CatalogProduct> { const response = await fetch(`${this.baseUrl}/products/${encodeURIComponent(id)}`); if (!response.ok) throw new HttpError(400, ERROR_KEYS.productUnknown, { id }); return response.json() as Promise<CatalogProduct>; }
}

export class OrderService {
  constructor(private readonly repository: Repository<Order>, private readonly catalog: ProductCatalog, private readonly promotions: PromotionValidator = new NoPromotionValidator()) {}
  async create(input: unknown, accountId: string): Promise<Order> {
    if (typeof input !== "object" || input === null) throw new HttpError(400, ERROR_KEYS.objectRequired);
    const values = (input as { items?: unknown }).items;
    if (!Array.isArray(values) || values.length < 1 || values.length > 25) throw new HttpError(400, ERROR_KEYS.itemCountInvalid);
    const items: OrderItem[] = []; let amount = 0;
    for (const value of values) { const body = requireFields(value, ["productId"]); const quantity = Number(body.quantity); if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new HttpError(400, ERROR_KEYS.quantityInvalid); const product = await this.catalog.get(String(body.productId)); items.push({ productId: product.id, quantity, unitPrice: product.price }); amount += product.price * quantity; }
    const promotionCode=(input as {promotionCode?:unknown}).promotionCode;const promotion=typeof promotionCode==="string"&&promotionCode.trim()?await this.promotions.validate(promotionCode,amount):undefined;
    return this.repository.save({ id: randomUUID(), accountId, items, subtotal:amount, discount:promotion?.discount??0, amount:Math.max(0,amount-(promotion?.discount??0)), ...(promotion?.promotionId?{promotionId:promotion.promotionId}:{}), currency: "USD", status: "pending", createdAt: new Date().toISOString() });
  }
  async get(id: string): Promise<Order> { const order = await this.repository.find(id); if (!order) throw new HttpError(404, ERROR_KEYS.orderNotFound, { id }); return order; }
  async history(accountId:string):Promise<Order[]>{return(await this.repository.list()).filter((order)=>order.accountId===accountId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  async getOwned(id:string,accountId:string):Promise<Order>{const order=await this.get(id);if(order.accountId!==accountId)throw new HttpError(404,ERROR_KEYS.orderNotFound,{id});return order;}
}

export function createOrderApp(): HttpApplication { const app = new HttpApplication("order-service"); const service = new OrderService(new InMemoryRepository<Order>(), new ProductCatalogClient(),new PromotionClient());const accounts=new AccountClient();app.route("GET", "/health", async () => ({ body: { service: "orders", status: "ok" } })); app.route("POST", "/orders", async (context) => ({ status: 201, body: await service.create(await context.json(),await accounts.authenticate(context.header.authorization)) as unknown as Json }));app.route("GET","/orders",async(context)=>({body:await service.history(await accounts.authenticate(context.header.authorization)) as unknown as Json})); app.route("GET", "/orders/:id", async (context) => {const id=context.params.id??"";const serviceKey=context.header["x-service-key"];if(typeof serviceKey==="string"&&serviceKey===process.env.SERVICE_API_KEY)return{body:await service.get(id) as unknown as Json};return{body:await service.getOwned(id,await accounts.authenticate(context.header.authorization)) as unknown as Json};}); return app; }
