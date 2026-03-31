/**
 * Next.js Instrumentation Hook — inicializa o scheduler ao subir o servidor.
 * Executado apenas no processo Node.js (não no Edge runtime).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { reloadScheduler } = await import('./lib/scheduler');
    reloadScheduler();
  }
}
