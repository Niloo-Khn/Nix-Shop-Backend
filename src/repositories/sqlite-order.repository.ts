import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Order, OrderItem } from "../services/orders.service.js";
import type { Repository } from "../shared/core.js";

type OrderRow = {
  id: string;
  account_id: string;
  items_json: string;
  subtotal: number;
  discount: number;
  shipping: number;
  amount: number;
  promotion_id: string | null;
  currency: string;
  status: string;
  shipping_address: string;
  created_at: string;
};

export class SqliteOrderRepository implements Repository<Order> {
  private readonly database: DatabaseSync;

  constructor(databasePath = process.env.ORDER_DATABASE_PATH ?? "data/orders.sqlite") {
    const path = resolve(databasePath);
    mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        items_json TEXT NOT NULL,
        subtotal REAL NOT NULL CHECK (subtotal >= 0),
        discount REAL NOT NULL CHECK (discount >= 0),
        shipping REAL NOT NULL CHECK (shipping >= 0),
        amount REAL NOT NULL CHECK (amount >= 0),
        promotion_id TEXT,
        currency TEXT NOT NULL CHECK (currency = 'USD'),
        status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled')),
        shipping_address TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS orders_account_created_idx
        ON orders (account_id, created_at DESC);
    `);
  }

  async list(): Promise<Order[]> {
    const rows = this.database.prepare(`
      SELECT id, account_id, items_json, subtotal, discount, shipping, amount,
             promotion_id, currency, status, shipping_address, created_at
      FROM orders
      ORDER BY created_at DESC
    `).all() as OrderRow[];
    return rows.map(toOrder);
  }

  async find(id: string): Promise<Order | undefined> {
    const row = this.database.prepare(`
      SELECT id, account_id, items_json, subtotal, discount, shipping, amount,
             promotion_id, currency, status, shipping_address, created_at
      FROM orders
      WHERE id = ?
    `).get(id) as OrderRow | undefined;
    return row ? toOrder(row) : undefined;
  }

  async save(order: Order): Promise<Order> {
    this.database.prepare(`
      INSERT INTO orders (
        id, account_id, items_json, subtotal, discount, shipping, amount,
        promotion_id, currency, status, shipping_address, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        account_id = excluded.account_id,
        items_json = excluded.items_json,
        subtotal = excluded.subtotal,
        discount = excluded.discount,
        shipping = excluded.shipping,
        amount = excluded.amount,
        promotion_id = excluded.promotion_id,
        currency = excluded.currency,
        status = excluded.status,
        shipping_address = excluded.shipping_address,
        created_at = excluded.created_at
    `).run(
      order.id,
      order.accountId,
      JSON.stringify(order.items),
      order.subtotal,
      order.discount,
      order.shipping,
      order.amount,
      order.promotionId ?? null,
      order.currency,
      order.status,
      order.shippingAddress,
      order.createdAt
    );
    return order;
  }
}

function toOrder(row: OrderRow): Order {
  const items = JSON.parse(row.items_json) as OrderItem[];
  return {
    id: row.id,
    accountId: row.account_id,
    items,
    subtotal: row.subtotal,
    discount: row.discount,
    shipping: row.shipping,
    amount: row.amount,
    ...(row.promotion_id ? { promotionId: row.promotion_id } : {}),
    currency: "USD",
    status: row.status as Order["status"],
    shippingAddress: row.shipping_address,
    createdAt: row.created_at
  };
}
