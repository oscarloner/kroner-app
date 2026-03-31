type AppHrefOptions = {
  accountSlug?: string;
  workspaceId?: string;
  monthKey?: string;
};

export function buildAppHref(path: string, options: AppHrefOptions) {
  const search = new URLSearchParams();

  if (options.accountSlug) {
    search.set("account", options.accountSlug);
  }

  if (options.workspaceId && options.workspaceId !== "all") {
    search.set("workspace", options.workspaceId);
  }

  if (options.monthKey) {
    search.set("month", options.monthKey);
  }

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
