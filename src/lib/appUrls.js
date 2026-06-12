export function withBase(path = "/") {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}` || "/";
}

export function absoluteAppUrl(path = "/") {
  return new URL(withBase(path), window.location.origin).toString();
}
