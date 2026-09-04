import test from "node:test";
import assert from "node:assert/strict";
import { createHelpApp } from "./help.js";
import { json, startService } from "./integration-test-helpers.js";
import { ERROR_KEYS } from "./message-keys.js";

test("help API lists article keys and accepts tickets", async (context) => {
  const service = await startService(createHelpApp());
  context.after(() => service.close());
  const articles = await fetch(`${service.baseUrl}/articles`);
  assert.equal(articles.status, 200);
  assert.deepEqual(await json<Array<{id:string}>>(articles), [{id:"shipping"},{id:"returns"},{id:"payments"}]);
  const ticket = await fetch(`${service.baseUrl}/tickets`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:"pet@example.com",subject:"Question",message:"Please help"}) });
  assert.equal(ticket.status, 201);
  assert.equal((await json<{status:string}>(ticket)).status, "open");
  const invalid = await fetch(`${service.baseUrl}/tickets`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:"pet@example.com"}) });
  assert.equal(invalid.status, 400);
  assert.equal((await json<{error:{key:string}}>(invalid)).error.key, ERROR_KEYS.fieldRequired);
});
