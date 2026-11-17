/** Rewrites incoming app links before Expo Router picks a screen. Never throw. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const withQuery = path.includes('#') ? path.replace('#', '?') : path;
    const queryIndex = withQuery.indexOf('?');
    const query = queryIndex >= 0 ? withQuery.slice(queryIndex + 1) : '';
    const params = new URLSearchParams(query);
    const looksLikeAuth =
      withQuery.includes('auth/callback') ||
      params.has('token_hash') ||
      params.has('access_token') ||
      (params.has('code') && (params.has('type') || withQuery.includes('callback')));
    if (!looksLikeAuth) {
      const productMatch = withQuery.match(
        /(?:p|product)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
      );
      if (productMatch) {
        return `/product/${productMatch[1]}`;
      }
      return withQuery;
    }
    return query ? `/auth/callback?${query}` : '/auth/callback';
  } catch {
    return path;
  }
}
