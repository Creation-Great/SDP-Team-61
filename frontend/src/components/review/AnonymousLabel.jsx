import { User, EyeOff } from 'lucide-react';

export default function AnonymousLabel({ name, anonymityLevel, anonymousId, role }) {
  if (role === 'instructor' || role === 'admin') {
    return <span className="flex items-center gap-1"><User size={14} />{name}</span>;
  }
  if (anonymityLevel === 'none') {
    return <span className="flex items-center gap-1"><User size={14} />{name}</span>;
  }
  return (
    <span className="flex items-center gap-1 text-slate-500 italic">
      <EyeOff size={14} />
      Anonymous Reviewer #{anonymousId || '?'}
    </span>
  );
}
