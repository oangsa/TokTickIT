/*
 * Reusable, resource-agnostic query construction (api-spec Section 9.6, BR-29).
 *
 * This module deliberately imports nothing: no Prisma types, no Ticket module,
 * no error helpers. That is the boundary the contract draws (BR-31): it
 * receives only already validated and typed input, and it does not own resource
 * field whitelists, field/condition permissions, conversions, ownership or
 * `deleted = false` predicates, semantic Priority ordering, or pagination.
 * Its unit tests use a fictional resource for the same reason -- a smuggled
 * Ticket rule would have nowhere to hide.
 *
 * The output is structurally a Prisma filter/order expression; the calling
 * resource casts it to its own `WhereInput` at the one boundary it owns.
 */

export const QUERY_CONDITIONS = [
  "CONTAINS",
  "STARTWITH",
  "ENDWITH",
  "EQUAL",
  "NOTEQUAL",
  "GREATER",
  "LESSER",
  "GREATEROREQUAL",
  "LESSEROREQUAL",
  "ISNULL",
  "ISNOTNULL",
  "IN",
] as const;

export type QueryCondition = (typeof QUERY_CONDITIONS)[number];

export type QueryScalar = string | number | boolean | Date;

export type SortDirection = "asc" | "desc";

/*
 * `caseInsensitive` is set by the resource validator and is never inferred from
 * the runtime type of `value`. Prisma's `IntFilter`, `DateTimeFilter`, and enum
 * filters have no `mode` property, so guessing "it is a string, so make it
 * insensitive" would emit `mode` onto an enum column and fail at query time.
 * Only the resource knows which of its fields are textual.
 */
export interface QueryExpression {
  field: string;
  condition: QueryCondition;
  value: QueryScalar | QueryScalar[] | null;
  caseInsensitive?: boolean;
}

export interface QuerySearch {
  fields: string[];
  term: string;
  caseInsensitive?: boolean;
}

export interface QuerySort {
  field: string;
  direction: SortDirection;
}

export type QueryFilter = Record<string, unknown>;

/*
 * Conditions whose Prisma filter honours `mode: "insensitive"` for text.
 *
 * `IN` is deliberately absent. Prisma's `StringFilter` type accepts `mode`
 * alongside `in`, so emitting it typechecks and looks correct in a unit
 * assertion, but Prisma's case-insensitive support covers `equals`,
 * `contains`, `startsWith`, `endsWith`, and `not` only: the flag is silently
 * ignored for `in`, and the match stays case-sensitive. Emitting a flag that
 * does nothing would promise a caller a semantic the database does not deliver.
 */
const TEXT_COMPARABLE = new Set<QueryCondition>([
  "CONTAINS",
  "STARTWITH",
  "ENDWITH",
  "EQUAL",
  "NOTEQUAL",
]);

/*
 * ponytail: `%` and `_` in a value reach PostgreSQL as LIKE wildcards. Prisma
 * parameterizes the value, so this is not injection and no scope predicate is
 * weakened, but a search for `100%` matches every row containing `100` and
 * `TKT_2026` matches `TKT-2026`. Escape the two characters and pass a LIKE
 * ESCAPE clause here if literal-wildcard search ever has to be correct.
 */
function buildFragment(expression: QueryExpression): Record<string, unknown> {
  const { condition, value } = expression;

  /*
   * The `never` default is load-bearing: adding a condition to
   * QUERY_CONDITIONS without handling it here becomes a compile error rather
   * than a silently dropped filter.
   */
  const fragment: Record<string, unknown> = ((): Record<string, unknown> => {
    switch (condition) {
      case "CONTAINS":
        return { contains: value };
      case "STARTWITH":
        return { startsWith: value };
      case "ENDWITH":
        return { endsWith: value };
      case "EQUAL":
        return { equals: value };
      case "NOTEQUAL":
        return { not: value };
      case "GREATER":
        return { gt: value };
      case "LESSER":
        return { lt: value };
      case "GREATEROREQUAL":
        return { gte: value };
      case "LESSEROREQUAL":
        return { lte: value };
      /* `value` is ignored for both null checks (api-spec Section 9.6). */
      case "ISNULL":
        return { equals: null };
      case "ISNOTNULL":
        return { not: null };
      case "IN":
        return { in: value };
      default: {
        const unreachable: never = condition;
        throw new Error(`Unsupported query condition: ${String(unreachable)}`);
      }
    }
  })();

  if (expression.caseInsensitive === true && TEXT_COMPARABLE.has(condition)) {
    fragment.mode = "insensitive";
  }

  return fragment;
}

export function buildFilter(expression: QueryExpression): QueryFilter {
  return { [expression.field]: buildFragment(expression) };
}

/*
 * BR-26/BR-30: every supplied search field matches the same term, and the
 * matches form exactly one `OR` group.
 */
export function buildSearchGroup(search: QuerySearch): QueryFilter {
  return {
    OR: search.fields.map((field) =>
      buildFilter({
        field,
        condition: "CONTAINS",
        value: search.term,
        caseInsensitive: search.caseInsensitive,
      }),
    ),
  };
}

/*
 * BR-30: `(searchField1 OR searchField2 OR ...) AND filter1 AND filter2 AND ...`
 *
 * The search group stays a single element of `AND` rather than being flattened
 * into it, because flattening would turn the OR group into an implicit
 * top-level disjunction and let a search term widen a caller's fixed predicate.
 * `base` is opaque here: the caller supplies ownership and lifecycle predicates
 * and this module never inspects or reorders them.
 */
export function buildWhere(input: {
  base?: QueryFilter[];
  search?: QuerySearch;
  filters?: QueryExpression[];
}): { AND: QueryFilter[] } {
  const conditions: QueryFilter[] = [...(input.base ?? [])];

  if (input.search !== undefined) {
    conditions.push(buildSearchGroup(input.search));
  }

  for (const expression of input.filters ?? []) {
    conditions.push(buildFilter(expression));
  }

  return { AND: conditions };
}

/*
 * Generic ascending/descending construction only. Any semantic ordering a
 * resource needs -- Ticket Priority, for one -- is the resource's own
 * translation into these already-generic terms (BR-31).
 */
export function buildOrderBy(sorts: QuerySort[]): Record<string, SortDirection>[] {
  return sorts.map((sort) => ({ [sort.field]: sort.direction }));
}
