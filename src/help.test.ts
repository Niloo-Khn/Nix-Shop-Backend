import test from "node:test";
import assert from "node:assert/strict";
import { HttpError, InMemoryRepository } from "./core.js";
import { HelpCenterService, type Article, type Ticket } from "./help.js";
import { ERROR_KEYS } from "./message-keys.js";

test("help service returns article keys without presentation text", async () => {
  const service = new HelpCenterService(new InMemoryRepository<Article>([{ id: "shipping" }]), new InMemoryRepository<Ticket>());
  assert.deepEqual(await service.articles(), [{ id: "shipping" }]);
});

test("help service creates open tickets and limits stored field lengths", async () => {
  const tickets = new InMemoryRepository<Ticket>();
  const service = new HelpCenterService(new InMemoryRepository<Article>(), tickets);
  const ticket = await service.createTicket({ email: "pet@example.com", subject: "s".repeat(150), message: "m".repeat(4500) });
  assert.equal(ticket.status, "open");
  assert.equal(ticket.subject.length, 120);
  assert.equal(ticket.message.length, 4000);
  assert.deepEqual(await tickets.find(ticket.id), ticket);
});

test("help service requires all ticket fields", async () => {
  const service = new HelpCenterService(new InMemoryRepository<Article>(), new InMemoryRepository<Ticket>());
  await assert.rejects(() => service.createTicket({ email: "pet@example.com", subject: "Question" }), (error: unknown) => error instanceof HttpError && error.key === ERROR_KEYS.fieldRequired);
});
