import { randomUUID } from "node:crypto";
import { HttpApplication, HttpError, InMemoryRepository, type Json, type Repository, requireFields } from "../shared/core.js";
import { ERROR_KEYS } from "../shared/message-keys.js";

export type OrderItem = { productId: string; quantity: number; unitPrice: number };
export type Order = { id: string; items: OrderItem[]; subtotal: number; discount: number; amount: number; promotionId?: string; currency: "USD"; status: "pending" | "paid" | "cancelled"; createdAt: string };
export type CatalogProduct = { id: string; price: number };
export interface ProductCatalog { get(id: string): Promise<CatalogProduct>; }
export interface PromotionValidator { validate(code: string, amount: number): Promise<{ promotionId: string; discount: number }>; }
export class NoPromotionValidator implements PromotionValidator { async validate(): Promise<{promotionId:string;discount:number}>{return{promotionId:"",discount:0};} }
export class PromotionClient implements PromotionValidator { constructor(private readonly baseUrl=process.env.PROMOTION_SERVICE_URL??"http://localhost:4006"){}async validate(code:string,amount:number){const response=await fetch(`${this.baseUrl}/promotions/validate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,amount})});if(!response.ok)throw new HttpError(response.status,ERROR_KEYS.promotionInvalid);return response.json() as Promise<{promotionId:string;discount:number}>;} }

export class ProductCatalogClient implements ProductCatalog {
  constructor(private readonly baseUrl = process.env.PRODUCT_SERVICE_URL ?? "http://localhost:4002") {}
  async get(id: string): Promise<CatalogProduct> { const response = await fetch(`${this.baseUrl}/products/${encodeURIComponent(id)}`); if (!response.ok) throw new HttpError(400, ERROR_KEYS.productUnknown, { id }); return response.json() as Promise<CatalogProduct>; }
}

export class OrderService {
  constructor(private readonly repository: Repository<Order>, private readonly catalog: ProductCatalog, private readonly promotions: PromotionValidator = new NoPromotionValidator()) {}
  async create(input: unknown): Promise<Order> {
    if (typeof input !== "object" || input === null) throw new HttpError(400, ERROR_KEYS.objectRequired);
    const values = (input as { items?: unknown }).items;
    if (!Array.isArray(values) || values.length < 1 || values.length > 25) throw new HttpError(400, ERROR_KEYS.itemCountInvalid);
    const items: OrderItem[] = []; let amount = 0;
    for (const value of values) { const body = requireFields(value, ["productId"]); const quantity = Number(body.quantity); if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new HttpError(400, ERROR_KEYS.quantityInvalid); const product = await this.catalog.get(String(body.productId)); items.push({ productId: product.id, quantity, unitPrice: product.price }); amount += product.price * quantity; }
    const promotionCode=(input as {promotionCode?:unknown}).promotionCode;const promotion=typeof promotionCode==="string"&&promotionCode.trim()?await this.promotions.validate(promotionCode,amount):undefined;
    return this.repository.save({ id: randomUUID(), items, subtotal:amount, discount:promotion?.discount??0, amount:Math.max(0,amount-(promotion?.discount??0)), ...(promotion?.promotionId?{promotionId:promotion.promotionId}:{}), currency: "USD", status: "pending", createdAt: new Date().toISOString() });
  }
  async get(id: string): Promise<Order> { const order = await this.repository.find(id); if (!order) throw new HttpError(404, ERROR_KEYS.orderNotFound, { id }); return order; }
}

export function createOrderApp(): HttpApplication { const app = new HttpApplication("order-service"); const service = new OrderService(new InMemoryRepository<Order>(), new ProductCatalogClient(),new PromotionClient()); app.route("GET", "/health", async () => ({ body: { service: "orders", status: "ok" } })); app.route("POST", "/orders", async (context) => ({ status: 201, body: await service.create(await context.json()) as unknown as Json })); app.route("GET", "/orders/:id", async (context) => ({ body: await service.get(context.params.id ?? "") as unknown as Json })); return app; }
