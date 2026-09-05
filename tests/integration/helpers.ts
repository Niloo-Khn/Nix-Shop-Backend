import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { InMemoryRepository, type HttpApplication } from "../../src/shared/core.js";
import { createAccountApp, type Account } from "../../src/services/accounts.service.js";

export type RunningService = { baseUrl: string; close(): Promise<void> };

export async function startService(app: HttpApplication): Promise<RunningService> {
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const address = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${address.port}`, close: () => closeServer(server) };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

export async function json<T>(response: Response): Promise<T> { return response.json() as Promise<T>; }

export async function startAuthenticatedAccount():Promise<{service:RunningService;authorization:string}>{process.env.AUTH_SECRET="integration-account-secret-with-32-characters";const service=await startService(createAccountApp(new InMemoryRepository<Account>()));await fetch(`${service.baseUrl}/accounts/register`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"history@example.com",displayName:"History User",password:"long-test-password"})});const response=await fetch(`${service.baseUrl}/accounts/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:"history@example.com",password:"long-test-password"})});const result=await json<{accessToken:string}>(response);return{service,authorization:`Bearer ${result.accessToken}`};}
