/*
 * The unauthenticated Lab 2 surface is restricted to development and test
 * (api-spec Section 1). One definition so the CORS allowlist fallback and the
 * unauthenticated bootstrap endpoint can never disagree about what counts.
 *
 * No default argument: `undefined` must mean "this caller has no NODE_ENV",
 * not "go read process.env", or `resolveAllowedOrigins({})` would silently
 * consult the ambient environment it was written to avoid.
 */
const DEVELOPMENT_ENVIRONMENTS = new Set(["development", "test"]);

export function isDevelopmentOrTest(nodeEnv: string | undefined): boolean {
  return nodeEnv === undefined || DEVELOPMENT_ENVIRONMENTS.has(nodeEnv);
}
