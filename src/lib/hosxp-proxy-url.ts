import { serverEnv } from "@/lib/server-env";

export function resolveHosxpProxyUrl() {
  return serverEnv("HEPA_HOSXP_PROXY_PUBLIC_URL") || serverEnv("HEPA_HOSXP_PROXY_URL");
}