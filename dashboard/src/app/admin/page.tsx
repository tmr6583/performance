import { getAuthUser } from '@/lib/auth';
import { resolveBasePath } from '@/lib/base-path';
import { redirect } from 'next/navigation';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPage() {
  const basePath = resolveBasePath();
  const user = await getAuthUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/');
  return <AdminClient basePath={basePath} userName={user.name} userId={user.id} />;
}
