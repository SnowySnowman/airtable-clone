import TablePage from './TablePage';

export default function Page({ params }: { params: { id: string } }) {
  return <TablePage tableId={params.id} />;
}