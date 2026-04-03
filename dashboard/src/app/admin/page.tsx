import { getAuthUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const user = await getAuthUser();
  if (!user) redirect(`${basePath}/login`);
  if (user.role !== 'admin') redirect(`${basePath}/`);
  return <AdminClient basePath={basePath} userName={user.name} />;
}
