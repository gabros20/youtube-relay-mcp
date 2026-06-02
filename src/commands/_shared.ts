export const PROXY_HINT =
  'From a datacenter/cloud IP, YouTube may block requests — run from a residential network.';

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
