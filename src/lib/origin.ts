export function isAllowedRequestOrigin(request: Request) {
  const originHeader = request.headers.get("origin");
  if (!originHeader) return true;

  let origin: URL;
  try {
    origin = new URL(originHeader);
  } catch {
    return false;
  }

  const requestUrl = new URL(request.url);
  return origin.host === requestUrl.host && origin.protocol === requestUrl.protocol;
}
