import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAccountApp } from "../../src/services/accounts.service.js";
import { SqliteAccountRepository } from "../../src/repositories/sqlite-account.repository.js";
import { startService } from "./helpers.js";

test("account database survives an account-service restart",async(context)=>{
  process.env.AUTH_SECRET="integration-persistence-secret-32-characters";
  const directory=await mkdtemp(join(tmpdir(),"nix-shop-accounts-"));
  context.after(()=>rm(directory,{recursive:true,force:true}));
  const databasePath=join(directory,"accounts.sqlite");
  const first=await startService(createAccountApp(new SqliteAccountRepository(databasePath)));
  const registration=await fetch(`${first.baseUrl}/accounts/register`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"persistent@example.com",firstName:"Persistent",familyName:"User",password:"long-test-password"})});
  assert.equal(registration.status,201);
  await first.close();
  const second=await startService(createAccountApp(new SqliteAccountRepository(databasePath)));
  context.after(()=>second.close());
  const login=await fetch(`${second.baseUrl}/accounts/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"persistent@example.com",password:"long-test-password"})});
  assert.equal(login.status,200);
});
