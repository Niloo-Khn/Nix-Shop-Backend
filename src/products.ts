import { randomUUID } from "node:crypto";
import { HttpApplication, HttpError, InMemoryRepository, type Json, type Repository, requireAdmin, requireFields } from "./core.js";

export type Product = { id: string; name: string; category: string; price: number; description: string; icon: string; color: string; active: boolean };
const seed: Product[] = [
  { id:"cloud-bed",name:"Cloud Nap Bed",category:"Dogs",price:68,description:"A washable, supportive bed for excellent naps.",icon:"☁️",color:"#dbe9df",active:true },
  { id:"mouse-toy",name:"Wool Mouse Duo",category:"Cats",price:14,description:"Soft, natural-wool toys made for curious paws.",icon:"🐭",color:"#f4dfcf",active:true },
  { id:"walk-set",name:"Everyday Walk Set",category:"Dogs",price:42,description:"A comfortable leash and harness for daily adventures.",icon:"🦮",color:"#d9e4ee",active:true },
  { id:"slow-bowl",name:"Calm Eating Bowl",category:"Everyday",price:24,description:"A non-slip bowl that helps pets eat at an easy pace.",icon:"🥣",color:"#eee4cb",active:true },
  { id:"groom-brush",name:"Gentle Groom Brush",category:"Everyday",price:18,description:"Rounded bristles for a calm, comfortable groom.",icon:"🪮",color:"#e3dced",active:true },
  { id:"treat-pouch",name:"Pocket Treat Pouch",category:"Dogs",price:22,description:"A neat, washable pouch for training and walks.",icon:"🦴",color:"#ead9d2",active:true }
];
export class ProductService {
  constructor(private readonly repository: Repository<Product>) {}
  async catalog(): Promise<Product[]> { return (await this.repository.list()).filter((product) => product.active); }
  async get(id: string): Promise<Product> { const product = await this.repository.find(id); if (!product?.active) throw new HttpError(404, "Product not found"); return product; }
  async create(input: unknown): Promise<Product> { const body = requireFields(input,["name","category","description"]); const price = Number(body.price); if (!Number.isFinite(price) || price < 0) throw new HttpError(400,"A valid price is required"); return this.repository.save({ id:randomUUID(),name:String(body.name),category:String(body.category),description:String(body.description),price,icon:typeof body.icon === "string"?body.icon:"🐾",color:typeof body.color === "string"?body.color:"#dbe9df",active:true }); }
}
export function createProductApp(): HttpApplication { const app=new HttpApplication("product-service"); const service=new ProductService(new InMemoryRepository(seed)); app.route("GET","/health",async()=>({body:{service:"products",status:"ok"}})); app.route("GET","/products",async()=>({body:await service.catalog() as unknown as Json})); app.route("GET","/products/:id",async(c)=>({body:await service.get(c.params.id ?? "") as unknown as Json})); app.route("POST","/products",async(c)=>{requireAdmin(c);return{status:201,body:await service.create(await c.json()) as unknown as Json};}); return app; }
