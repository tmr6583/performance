export function resolveBasePath(): string {
  const configured = process.env.NEXT_PUBLIC_BASE_PATH?.trim();
  if (configured && configured !== '/') {
    return configured.startsWith('/') ? configured : `/${configured}`;
  }
  return process.env.NODE_ENV === 'production' ? '/performance' : '';
}
