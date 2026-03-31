import { getAuthUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/');

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  return <AdminClient basePath={basePath} userName={user.name} />;
}
