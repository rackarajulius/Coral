import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { resetFilters } from "@/store/jobsSlice";

const EmptyState = () => {
  const dispatch = useAppDispatch();

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center">
      {/* Minimalist SVG Illustration */}
      <div className="w-32 h-32 mb-6 rounded-full bg-coral/50 flex items-center justify-center">
        <SearchX className="w-16 h-16 text-white" strokeWidth={1} />
      </div>

      <h3 className="font-display text-xl font-semibold text-foreground mb-2">
        No results found
      </h3>
      
      <p className="text-muted-foreground text-sm max-w-xs mb-6">
        We couldn't find any jobs matching your criteria. Try adjusting your filters or search terms.
      </p>

      <Button
        variant="default"
        size="sm"
        onClick={() => dispatch(resetFilters())}
        className="text-sm"
      >
        Clear all filters
      </Button>
    </div>
  );
};

export default EmptyState;