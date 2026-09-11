import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Payment, PaymentRepository } from "../services/payments.service.js";

type PaymentRow = { id:string;order_id:string;account_id:string;idempotency_key:string;amount:number;currency:string;payment_method:string;status:string;checkout_url:string;provider_reference:string;created_at:string;updated_at:string };
const selectSql = `SELECT id, order_id, account_id, idempotency_key, amount, currency, payment_method, status, checkout_url, provider_reference, created_at, updated_at FROM payments`;

export class SqlitePaymentRepository implements PaymentRepository {
  private readonly database: DatabaseSync;
  constructor(databasePath = process.env.PAYMENT_DATABASE_PATH ?? "data/payments.sqlite") {
    const path=resolve(databasePath);mkdirSync(dirname(path),{recursive:true});this.database=new DatabaseSync(path);
    this.database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    this.database.exec(`CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY, order_id TEXT NOT NULL, account_id TEXT NOT NULL, idempotency_key TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0), currency TEXT NOT NULL CHECK (currency = 'USD'),
      payment_method TEXT NOT NULL CHECK (payment_method IN ('paypal','apple_pay','klarna','card')),
      status TEXT NOT NULL CHECK (status IN ('pending','paid','failed','cancelled')),
      checkout_url TEXT NOT NULL, provider_reference TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE (account_id, idempotency_key)) STRICT;
      CREATE INDEX IF NOT EXISTS payments_order_idx ON payments (order_id);`);
  }
  async find(id:string):Promise<Payment|undefined>{return this.one("id = ?",id);}
  async findByIdempotency(accountId:string,key:string):Promise<Payment|undefined>{const row=this.database.prepare(`${selectSql} WHERE account_id = ? AND idempotency_key = ?`).get(accountId,key) as PaymentRow|undefined;return row?toPayment(row):undefined;}
  async findByProviderReference(reference:string):Promise<Payment|undefined>{return this.one("provider_reference = ?",reference);}
  async save(payment:Payment):Promise<Payment>{this.database.prepare(`INSERT INTO payments (id,order_id,account_id,idempotency_key,amount,currency,payment_method,status,checkout_url,provider_reference,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,checkout_url=excluded.checkout_url,provider_reference=excluded.provider_reference,updated_at=excluded.updated_at`).run(payment.id,payment.orderId,payment.accountId,payment.idempotencyKey,payment.amount,payment.currency,payment.paymentMethod,payment.status,payment.checkoutUrl,payment.providerReference,payment.createdAt,payment.updatedAt);return payment;}
  private one(where:string,value:string):Payment|undefined{const row=this.database.prepare(`${selectSql} WHERE ${where}`).get(value) as PaymentRow|undefined;return row?toPayment(row):undefined;}
}
function toPayment(row:PaymentRow):Payment{return{id:row.id,orderId:row.order_id,accountId:row.account_id,idempotencyKey:row.idempotency_key,amount:row.amount,currency:"USD",paymentMethod:row.payment_method as Payment["paymentMethod"],status:row.status as Payment["status"],checkoutUrl:row.checkout_url,providerReference:row.provider_reference,createdAt:row.created_at,updatedAt:row.updated_at};}
