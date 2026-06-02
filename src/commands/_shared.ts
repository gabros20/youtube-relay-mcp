export const PROXY_HINT =
  'If running in a cloud sandbox, YouTube may block datacenter IPs — set YTRELAY_PROXY to a residential proxy.';

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
