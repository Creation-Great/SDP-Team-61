import Badge from '../ui/Badge';

export default function SimilarityBadge({ score }) {
  if (score == null) return null;
  const pct = Math.round(score * 100);
  const type = pct >= 50 ? 'error' : pct >= 30 ? 'warning' : 'success';
  return <Badge type={type}>{pct}% similar</Badge>;
}
