const FORM_ROUTE_PATTERNS = [
  /^\/income\/nuevo\/?$/,
  /^\/income\/[^/]+\/editar\/?$/,
  /^\/expenses\/nuevo\/?$/,
  /^\/expenses\/[^/]+\/editar\/?$/,
  /^\/agenda\/nueva\/?$/,
  /^\/agenda\/[^/]+\/editar\/?$/,
  /^\/temporadas\/nueva\/?$/,
]

/**
 * Routes that own editable, not-yet-persisted form state. The global usage
 * context switcher stays hidden there so changing workspace cannot silently
 * discard the form. Query strings are intentionally irrelevant.
 */
export function isDataEntryFormRoute(pathname: string): boolean {
  return FORM_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))
}
