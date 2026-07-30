// DELETED — scraping system removed. Affiliate now uses manual input only.
export async function POST() {
  return new Response(JSON.stringify({ success: false, error: 'Endpoint dinonaktifkan' }), { status: 410 });
}