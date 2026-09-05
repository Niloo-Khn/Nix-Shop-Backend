import test from "node:test";
import assert from "node:assert/strict";
import { createAccountApp, type Account } from "../../src/services/accounts.service.js";
import { json, startService } from "./helpers.js";
import { ERROR_KEYS } from "../../src/shared/message-keys.js";
import { InMemoryRepository } from "../../src/shared/core.js";

test("account API registers and authenticates through HTTP", async (context) => {
  process.env.AUTH_SECRET = "integration-test-secret-with-32-characters";
  const service = await startService(createAccountApp(new InMemoryRepository<Account>()));
  context.after(() => service.close());
  const preflight = await fetch(`${service.baseUrl}/accounts/register`, { method:"OPTIONS", headers:{Origin:"http://localhost:4173","Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"content-type"} });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:4173");
  const registration = await fetch(`${service.baseUrl}/accounts/register`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:"pet@example.com",displayName:"Pet Owner",password:"long-test-password"}) });
  assert.equal(registration.status, 201);
  assert.equal((await json<{email:string}>(registration)).email, "pet@example.com");
  const login = await fetch(`${service.baseUrl}/accounts/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:"pet@example.com",password:"long-test-password"}) });
  assert.equal(login.status, 200);
  assert.match((await json<{accessToken:string}>(login)).accessToken, /^[\w-]+\.[\w-]+$/);
  const authenticated=await fetch(`${service.baseUrl}/accounts/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"pet@example.com",password:"long-test-password"})});
  const authorization=`Bearer ${(await json<{accessToken:string}>(authenticated)).accessToken}`;
  const update=await fetch(`${service.baseUrl}/accounts/me`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:authorization},body:JSON.stringify({displayName:"Pet Parent",phone:"555-0100",address:"1 Pet Street",birthday:"1990-05-12"})});
  assert.equal(update.status,200);assert.equal((await json<{address:string}>(update)).address,"1 Pet Street");
  const reset=await fetch(`${service.baseUrl}/accounts/password-reset/request`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"unknown@example.com"})});assert.equal(reset.status,202);assert.deepEqual(await json(reset),{accepted:true});
  const rejected = await fetch(`${service.baseUrl}/accounts/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:"pet@example.com",password:"wrong-password"}) });
  assert.equal(rejected.status, 401);
  assert.equal((await json<{error:{key:string}}>(rejected)).error.key, ERROR_KEYS.credentialsInvalid);
});
