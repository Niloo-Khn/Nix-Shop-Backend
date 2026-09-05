import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Account } from "../services/accounts.service.js";
import type { Repository } from "../shared/core.js";

type AccountRow = { id:string;email:string;display_name:string;password_hash:string;created_at:string };

export class SqliteAccountRepository implements Repository<Account> {
  private readonly database:DatabaseSync;
  constructor(databasePath=process.env.ACCOUNT_DATABASE_PATH??"data/accounts.sqlite") {
    const path=resolve(databasePath);mkdirSync(dirname(path),{recursive:true});this.database=new DatabaseSync(path);
    this.database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    this.database.exec("CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;");
  }
  async list():Promise<Account[]>{return(this.database.prepare("SELECT id, email, display_name, password_hash, created_at FROM accounts ORDER BY created_at").all() as AccountRow[]).map(toAccount);}
  async find(id:string):Promise<Account|undefined>{const row=this.database.prepare("SELECT id, email, display_name, password_hash, created_at FROM accounts WHERE id = ?").get(id) as AccountRow|undefined;return row?toAccount(row):undefined;}
  async save(account:Account):Promise<Account>{this.database.prepare("INSERT INTO accounts (id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(account.id,account.email,account.displayName,account.passwordHash,account.createdAt);return account;}
}
function toAccount(row:AccountRow):Account{return{id:row.id,email:row.email,displayName:row.display_name,passwordHash:row.password_hash,createdAt:row.created_at};}
