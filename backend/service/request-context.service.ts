import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  method: string;
  route?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(
  context: RequestContext,
  callback: () => T
): T => storage.run(context, callback);

export const getRequestContext = (): RequestContext | undefined =>
  storage.getStore();

export const setRequestRoute = (route: string): void => {
  const context = storage.getStore();

  if (context) {
    context.route = route;
  }
};
