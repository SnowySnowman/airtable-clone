'use client';

import { useParams } from 'next/navigation';
import { api } from '~/trpc/react';
import Link from 'next/link';

export default function BasePage() {
  const params = useParams();
  const baseId = params?.baseId as string;

  const { data: base, isLoading } = api.base.getOne.useQuery(
    { baseId },
    { enabled: !!baseId }
  );

  if (isLoading) return <p>Loading base...</p>;
  if (!base) return <p>Base not found</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">{base.name}</h1>
      <p>{base.tables.length} table(s)</p>
      {/* Table list and create table button can go here */}
    </div>
  );
}
