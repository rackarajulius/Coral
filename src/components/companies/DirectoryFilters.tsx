import { X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { industries } from "@/data/companies/mockCompanies";

export interface Filters {
  industries: string[];
}

interface FilterDrawerProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  isOpen: boolean;
  onClose: () => void;
}

const FilterSection = ({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: string[];
  selected: string[];
  onToggle: (item: string) => void;
}) => (
  <div>
    <h3 className="font-medium text-sm mb-3">{title}</h3>
    <div className="space-y-2">
      {items.map((item) => (
        <label key={item} className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={selected.includes(item)}
            onCheckedChange={() => onToggle(item)}
          />
          <span className="text-sm">{item}</span>
        </label>
      ))}
    </div>
  </div>
);

const DirectoryFilters = ({ filters, onFiltersChange, isOpen, onClose }: FilterDrawerProps) => {
  const toggleIndustry = (value: string) => {
    const updated = filters.industries.includes(value)
      ? filters.industries.filter((v) => v !== value)
      : [...filters.industries, value];
    onFiltersChange({ ...filters, industries: updated });
  };

  const clearAll = () => onFiltersChange({ industries: [] });

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Desktop: Left Drawer | Mobile: Bottom Sheet */}
       <div
         className={cn(
           "fixed bg-white dark:bg-gray-900 z-50 shadow-xl flex flex-col",
           "transition-transform duration-300 ease-in-out",
           // Desktop: Left sidebar drawer
           "md:top-0 md:left-0 md:h-full md:w-[300px] md:max-w-[85vw]",
           isOpen ? "md:translate-x-0" : "md:-translate-x-full",
           // Mobile: Bottom sheet
           "max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:max-h-[85vh] max-md:rounded-t-lg border-t border-gray-400 dark:border-gray-700",
           isOpen ? "max-md:translate-y-0" : "max-md:translate-y-full"
         )}
       >
         {/* Mobile: Drag handle indicator */}
         <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
           <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
         </div>

         {/* Header */}
         <div className="flex items-center justify-between p-4 border-b border-gray-300 dark:border-gray-700 shrink-0">
          <h2 className="font-semibold text-lg">Filters</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable filter sections */}
        <div className="flex-1 overflow-y-auto scrollbar p-4 space-y-6">
          <FilterSection
            title="Industry"
            items={industries}
            selected={filters.industries}
            onToggle={toggleIndustry}
          />
        </div>

         {/* Actions (sticky footer) */}
         <div className="shrink-0 p-4 border-t border-gray-300 dark:border-gray-700 flex gap-2 bg-white dark:bg-gray-900">
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            className="flex-1"
          >
            Reset
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onClose}
            className="flex-1"
          >
            Apply
          </Button>
        </div>
      </div>
    </>
  );
};

export default DirectoryFilters;
