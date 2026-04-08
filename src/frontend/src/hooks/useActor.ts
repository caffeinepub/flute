/**
 * Stub hook — the backend canister has no methods (empty interface).
 * All data is stored locally. This stub satisfies the import in useQueries.ts.
 */
export function useActor() {
  return { actor: null as null, isFetching: false };
}
