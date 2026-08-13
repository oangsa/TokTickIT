const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// ponytail: per-request timeout, not a total budget — worst case is 2x this
// across both calls. Share one AbortSignal if the total ever needs a cap.
const TIMEOUT_MS = 8000;

export interface Category {
  id: number;
  name: string;
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}

// Issue 2 + Issue 4 — call the backend.
// Steps: fetch `${API_URL}/api/health`; if not ok, throw.
//        then fetch `${API_URL}/api/categories`; if not ok, throw.
//        return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  const health = await fetch(`${API_URL}/api/health`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => {
    throw new Error(`Cannot reach the TokTickIT API at ${API_URL}.`);
  });
  if (!health.ok) {
    throw new Error(`Backend health check failed (HTTP ${health.status})`);
  }

  const response = await fetch(`${API_URL}/api/categories`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => {
    throw new Error(`Cannot reach the TokTickIT API at ${API_URL}.`);
  });
  if (!response.ok) {
    throw new Error(`Could not load categories (HTTP ${response.status})`);
  }

  const categories: Category[] = await response.json().catch(() => {
    throw new Error("Could not read the categories response.");
  });

  return { online: true, categories };
}
