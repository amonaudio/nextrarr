/**
 * GET /api/health — simple healthcheck used by Docker HEALTHCHECK.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ status: 'ok' });
}
