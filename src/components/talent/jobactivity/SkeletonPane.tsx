import SkeletonCard from './SkeletonCard';
import type { TabId } from './constants';

const SkeletonPane = ({ tab }: { tab: TabId }) => {
  if (tab === "interviews") {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading interviews">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }
  if (tab === "applied") {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading applications">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" aria-busy="true" aria-label={`Loading ${tab}`}>
      {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
};

export default SkeletonPane;
