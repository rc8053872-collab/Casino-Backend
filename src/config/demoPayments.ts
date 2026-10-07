export function areDemoPaymentsEnabled() {
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_DEMO_DEPOSITS !== 'true') {
    return false;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return false;

  try {
    const hostname = new URL(databaseUrl).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}
