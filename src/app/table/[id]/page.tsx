import TablePage from './TablePage';

export default function Page({ params }: any) {
  return <TablePage tableId={params.id} />;
}
