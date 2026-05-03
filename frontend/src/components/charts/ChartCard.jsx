import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';

export default function ChartCard({ title, loading, children, className = '' }) {
  return (
    <Card className={`p-5 ${className}`}>
      <h3 className="text-lg font-semibold text-[#000E2F] mb-4">{title}</h3>
      {loading ? <Skeleton variant="row" count={5} /> : children}
    </Card>
  );
}
