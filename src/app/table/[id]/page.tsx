import TablePage from './TablePage';
import type { Metadata, ResolvingMetadata } from 'next';

type PageProps = {
  params: {
    id: string;
  };
};

export default function Page({ params }: PageProps) {
  return <TablePage tableId={params.id} />;
}
