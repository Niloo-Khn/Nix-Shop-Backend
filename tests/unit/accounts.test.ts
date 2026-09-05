import test from "node:test";
import assert from "node:assert/strict";
import { AccountService, PasswordHasher, TokenIssuer, type Account } from "../../src/services/accounts.service.js";
import { HttpError, InMemoryRepository } from "../../src/shared/core.js";
import { ERROR_KEYS } from "../../src/shared/message-keys.js";

test("account service registers and logs in a normalized account", async () => {
  const repository = new InMemoryRepository<Account>();
  const service = new AccountService(repository, new PasswordHasher(), new TokenIssuer("a-secure-test-secret-with-32-characters"));
  const account = await service.register({ email: "  PET@Example.com ", firstName: "Pet", familyName: "Owner", password: "long-test-password" });
  assert.equal(account.email, "pet@example.com");
  const stored = await repository.find(account.id);
  assert.ok(stored);
  assert.notEqual(stored.passwordHash, "long-test-password");
  const login = await service.login({ email: "pet@example.com", password: "long-test-password" });
  assert.equal(login.tokenType, "Bearer");
  assert.match(login.accessToken, /^[\w-]+\.[\w-]+$/);
});

test("account service rejects duplicate accounts and invalid credentials", async () => {
  const service = new AccountService(new InMemoryRepository<Account>(), new PasswordHasher(), new TokenIssuer("a-secure-test-secret-with-32-characters"));
  const input = { email: "pet@example.com", firstName: "Pet", familyName: "Owner", password: "long-test-password" };
  await service.register(input);
  await assert.rejects(() => service.register(input), (error: unknown) => error instanceof HttpError && error.key === ERROR_KEYS.accountExists);
  await assert.rejects(() => service.login({ email: input.email, password: "wrong-password" }), (error: unknown) => error instanceof HttpError && error.key === ERROR_KEYS.credentialsInvalid);
});

test("password hashes use unique salts and verify safely", async () => {
  const hasher = new PasswordHasher();
  const first = await hasher.hash("long-test-password");
  const second = await hasher.hash("long-test-password");
  assert.notEqual(first, second);
  assert.equal(await hasher.verify("long-test-password", first), true);
  assert.equal(await hasher.verify("wrong-password", first), false);
});

test("account service reads and updates profile details",async()=>{const repository=new InMemoryRepository<Account>();const service=new AccountService(repository,new PasswordHasher(),new TokenIssuer("a-secure-test-secret-with-32-characters"));const account=await service.register({email:"profile@example.com",firstName:"Old",familyName:"Name",password:"long-test-password"});const updated=await service.update(account.id,{firstName:"Dr. Jane",familyName:"O’Neil-Smith",phone:"+1 555 123 4567",address:"1 Pet Street",birthday:"1990-05-12"});assert.equal(updated.displayName,"Dr. Jane O’Neil-Smith");assert.equal(updated.phone,"+15551234567");assert.equal(updated.address,"1 Pet Street");assert.equal("passwordHash" in updated,false);assert.deepEqual(await service.profile(account.id),updated);});
test("account service rejects invalid names, email domains, and phone numbers",async()=>{const service=new AccountService(new InMemoryRepository<Account>(),new PasswordHasher(),new TokenIssuer("a-secure-test-secret-with-32-characters"));const base={email:"pet@example.com",firstName:"Pet",familyName:"Owner",password:"long-test-password"};await assert.rejects(()=>service.register({...base,firstName:"Pet123"}),(error:unknown)=>error instanceof HttpError&&error.key===ERROR_KEYS.nameInvalid);await assert.rejects(()=>service.register({...base,email:"pet@example"}),(error:unknown)=>error instanceof HttpError&&error.key===ERROR_KEYS.emailInvalid);await assert.rejects(()=>service.register({...base,phone:"555-0100"}),(error:unknown)=>error instanceof HttpError&&error.key===ERROR_KEYS.phoneInvalid);});
test("password reset requests do not reveal whether an account exists",async()=>{const service=new AccountService(new InMemoryRepository<Account>(),new PasswordHasher(),new TokenIssuer("a-secure-test-secret-with-32-characters"));assert.deepEqual(await service.requestPasswordReset({email:"unknown@example.com"}),{accepted:true});});
