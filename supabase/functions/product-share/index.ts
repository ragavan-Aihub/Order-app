const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function productIdFromRequest(req: Request): string | null {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('id');
  if (fromQuery && UUID_RE.test(fromQuery)) {
    return fromQuery;
  }
  const match = url.pathname.match(UUID_RE);
  return match?.[0] ?? null;
}

Deno.serve((req) => {
  const productId = productIdFromRequest(req);
  if (!productId) {
    return new Response('Not found', { status: 404 });
  }

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
  const target = `${supabaseUrl}/storage/v1/object/public/product-share-web/open.html?id=${encodeURIComponent(productId)}`;
  return Response.redirect(target, 302);
});
