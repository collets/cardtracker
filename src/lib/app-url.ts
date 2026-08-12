export function buildAppUrl(baseUrl: string, pathname: `/${string}`): string {
  return new URL(pathname, baseUrl).toString();
}
