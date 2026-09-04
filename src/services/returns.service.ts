import { randomUUID } from "node:crypto";
import { HttpApplication, HttpError, InMemoryRepository, type Json, type Repository, requireFields } from "../shared/core.js";
import { ERROR_KEYS } from "../shared/message-keys.js";
import type { Order } from "./orders.service.js";

export type ReturnItem={productId:string;quantity:number};
export type ReturnRequest={id:string;orderId:string;items:ReturnItem[];reasonKey:string;status:"requested";createdAt:string};
export interface OrderReader{get(id:string):Promise<Order>;}
export class OrderClient implements OrderReader{constructor(private readonly baseUrl=process.env.ORDER_SERVICE_URL??"http://localhost:4005"){}async get(id:string):Promise<Order>{const response=await fetch(`${this.baseUrl}/orders/${encodeURIComponent(id)}`);if(!response.ok)throw new HttpError(404,ERROR_KEYS.orderNotFound,{id});return response.json() as Promise<Order>;}}
export class ReturnService{
  constructor(private readonly repository:Repository<ReturnRequest>,private readonly orders:OrderReader){}
  async create(input:unknown):Promise<ReturnRequest>{const body=requireFields(input,["orderId","reasonKey"]);const order=await this.orders.get(String(body.orderId));const values=(input as {items?:unknown}).items;if(!Array.isArray(values)||values.length<1)throw new HttpError(400,ERROR_KEYS.returnItemsInvalid);const items:ReturnItem[]=values.map((value)=>{const item=requireFields(value,["productId"]);const quantity=Number(item.quantity);const ordered=order.items.find((line)=>line.productId===item.productId);if(!ordered||!Number.isInteger(quantity)||quantity<1||quantity>ordered.quantity)throw new HttpError(400,ERROR_KEYS.returnQuantityInvalid);return{productId:String(item.productId),quantity};});return this.repository.save({id:randomUUID(),orderId:order.id,items,reasonKey:String(body.reasonKey).slice(0,80),status:"requested",createdAt:new Date().toISOString()});}
  async get(id:string):Promise<ReturnRequest>{const request=await this.repository.find(id);if(!request)throw new HttpError(404,ERROR_KEYS.orderNotFound,{id});return request;}
}
export function createReturnApp():HttpApplication{const app=new HttpApplication("return-service");const service=new ReturnService(new InMemoryRepository<ReturnRequest>(),new OrderClient());app.route("GET","/health",async()=>({body:{service:"returns",status:"ok"}}));app.route("POST","/returns",async(context)=>({status:201,body:await service.create(await context.json()) as unknown as Json}));app.route("GET","/returns/:id",async(context)=>({body:await service.get(context.params.id??"") as unknown as Json}));return app;}
