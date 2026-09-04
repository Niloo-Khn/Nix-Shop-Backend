import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { HttpApplication } from "../../src/shared/core.js";

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
