import test from "node:test";
import assert from "node:assert/strict";
import { createAccountApp } from "./accounts.js";
import { json, startService } from "./integration-test-helpers.js";
import { ERROR_KEYS } from "./message-keys.js";

test("account API registers and authenticates through HTTP", async (context) => {
  process.env.AUTH_SECRET = "integration-test-secret-with-32-characters";
  const service = await startService(createAccountApp());
  context.after(() => service.close());
  const registration = await fetch(`${service.baseUrl}/accounts/register`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:"pet@example.com",displayName:"Pet Owner",password:"long-test-password"}) });
  assert.equal(registration.status, 201);
  assert.equal((await json<{email:string}>(registration)).email, "pet@example.com");
  const login = await fetch(`${service.baseUrl}/accounts/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:"pet@example.com",password:"long-test-password"}) });
  assert.equal(login.status, 200);
  assert.match((await json<{accessToken:string}>(login)).accessToken, /^[\w-]+\.[\w-]+$/);
  const rejected = await fetch(`${service.baseUrl}/accounts/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:"pet@example.com",password:"wrong-password"}) });
  assert.equal(rejected.status, 401);
  assert.equal((await json<{error:{key:string}}>(rejected)).error.key, ERROR_KEYS.credentialsInvalid);
});
