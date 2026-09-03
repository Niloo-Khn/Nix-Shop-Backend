import { randomUUID } from "node:crypto";
import { HttpApplication, HttpError, InMemoryRepository, type Json, type Repository, requireAdmin, requireFields } from "./core.js";

export type Product = { id: string; sku: string; price: number; active: boolean };
const seed: Product[] = [
  { id:"cloud-bed",sku:"NIX-BED-001",price:68,active:true },
  { id:"mouse-toy",sku:"NIX-TOY-001",price:14,active:true },
  { id:"walk-set",sku:"NIX-WALK-001",price:42,active:true },
  { id:"slow-bowl",sku:"NIX-BOWL-001",price:24,active:true },
  { id:"groom-brush",sku:"NIX-GROOM-001",price:18,active:true },
  { id:"treat-pouch",sku:"NIX-TREAT-001",price:22,active:true }
];
export class ProductService {
  constructor(private readonly repository: Repository<Product>) {}
  async catalog(): Promise<Product[]> { return (await this.repository.list()).filter((product) => product.active); }
  async get(id: string): Promise<Product> { const product = await this.repository.find(id); if (!product?.active) throw new HttpError(404, "Product not found"); return product; }
  async create(input: unknown): Promise<Product> { const body = requireFields(input,["sku"]); const price = Number(body.price); if (!Number.isFinite(price) || price < 0) throw new HttpError(400,"A valid price is required"); return this.repository.save({ id:randomUUID(),sku:String(body.sku).slice(0,64),price,active:true }); }
}
export function createProductApp(): HttpApplication { const app=new HttpApplication("product-service"); const service=new ProductService(new InMemoryRepository(seed)); app.route("GET","/health",async()=>({body:{service:"products",status:"ok"}})); app.route("GET","/products",async()=>({body:await service.catalog() as unknown as Json})); app.route("GET","/products/:id",async(c)=>({body:await service.get(c.params.id ?? "") as unknown as Json})); app.route("POST","/products",async(c)=>{requireAdmin(c);return{status:201,body:await service.create(await c.json()) as unknown as Json};}); return app; }
