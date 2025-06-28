import TablePage from './TablePage';

type PageProps = {
  params: {
    id: string;
  };
};

export default function Page({ params }: PageProps) {
  return <TablePage tableId={params.id} />;
}
