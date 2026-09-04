import test from "node:test";
import assert from "node:assert/strict";
import { AccountService, PasswordHasher, TokenIssuer, type Account } from "./accounts.js";
import { HttpError, InMemoryRepository } from "./core.js";
import { ERROR_KEYS } from "./message-keys.js";

test("account service registers and logs in a normalized account", async () => {
  const repository = new InMemoryRepository<Account>();
  const service = new AccountService(repository, new PasswordHasher(), new TokenIssuer("a-secure-test-secret-with-32-characters"));
  const account = await service.register({ email: "  PET@Example.com ", displayName: "Pet Owner", password: "long-test-password" });
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
  const input = { email: "pet@example.com", displayName: "Pet Owner", password: "long-test-password" };
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
