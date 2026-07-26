// Small shared HTTP response helpers used across route handlers.
export function noindex(headers) {
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return headers;
}

export function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: noindex(new Headers({ "Content-Type": "application/json" })),
  });
}

export function jsonOk(body) {
  return new Response(JSON.stringify(body), {
    headers: noindex(new Headers({ "Content-Type": "application/json" })),
  });
}
