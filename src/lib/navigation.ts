// Saved work, try-on favorites and history keep their existing storage/routes.
export function navigationItemActive(href: string, pathname: string) {
  if (href === "/favorites") return ["/favorites", "/history", "/collections"].includes(pathname);
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
