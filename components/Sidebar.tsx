const NAV_ITEMS = [
  { href: "/", label: "Oversikt" },
  { href: "/transaksjoner", label: "Transaksjoner" },
  { href: "/faste", label: "Faste inntekter" },
  { href: "/abonnementer", label: "Abonnementer" },
  { href: "/graf", label: "Graf" }
] as const;

function withAccount(path: string, accountSlug?: string) {
  if (!accountSlug) {
    return path;
  }

  return `${path}?account=${encodeURIComponent(accountSlug)}`;
}

export function Sidebar({
  currentPath,
  currentAccountSlug
}: {
  currentPath: string;
  currentAccountSlug?: string;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebarTop">
        <div className="brand">Kroner</div>
        <div className="brandSub">Next.js + Supabase</div>
      </div>
      <nav className="sidebarNav">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? currentPath === "/" : currentPath.startsWith(item.href);

          return (
            <a
              key={item.href}
              href={withAccount(item.href, currentAccountSlug)}
              className={active ? "navItem active" : "navItem"}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
