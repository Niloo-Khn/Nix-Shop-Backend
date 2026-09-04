import { HttpApplication, HttpError, type Json, requireFields } from "../shared/core.js";
import { ERROR_KEYS } from "../shared/message-keys.js";

export type Promotion = { id: string; code: string; kind: "percentage" | "fixed"; value: number; minimumAmount: number; active: boolean };
const promotions: Promotion[] = [
  { id: "welcome-10", code: "WELCOME10", kind: "percentage", value: 10, minimumAmount: 30, active: true },
  { id: "pet-five", code: "PET5", kind: "fixed", value: 5, minimumAmount: 25, active: true }
];

export class PromotionService {
  constructor(private readonly rules: Promotion[] = promotions) {}
  list(): Promotion[] { return this.rules.filter((promotion) => promotion.active); }
  validate(input: unknown): { promotionId: string; discount: number } {
    const body = requireFields(input, ["code"]); const amount = Number(body.amount); const code = String(body.code).trim().toUpperCase();
    const promotion = this.rules.find((rule) => rule.code === code);
    if (!promotion) throw new HttpError(404, ERROR_KEYS.promotionInvalid);
    if (!promotion.active || !Number.isFinite(amount) || amount < promotion.minimumAmount) throw new HttpError(409, ERROR_KEYS.promotionInactive);
    const raw = promotion.kind === "percentage" ? amount * promotion.value / 100 : promotion.value;
    return { promotionId: promotion.id, discount: Math.min(amount, Math.round(raw * 100) / 100) };
  }
}
export function createPromotionApp(): HttpApplication { const app=new HttpApplication("promotion-service");const service=new PromotionService();app.route("GET","/health",async()=>({body:{service:"promotions",status:"ok"}}));app.route("GET","/promotions",async()=>({body:service.list() as unknown as Json}));app.route("POST","/promotions/validate",async(context)=>({body:service.validate(await context.json()) as Json}));return app;}
