import { Search, SlidersHorizontal, MapPin } from "lucide-react";

interface DirectoryHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  locationQuery?: string;
  onLocationChange?: (query: string) => void;
  onOpenFilters?: () => void;
  activeFilterCount?: number;
}

const DirectoryHeader = ({
  searchQuery,
  onSearchChange,
  locationQuery = "",
  onLocationChange,
  onOpenFilters,
  activeFilterCount = 0,
}: DirectoryHeaderProps) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <div className="mb-8">
      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 text-center">
        Discover <span className="gradient-text">Companies</span>
      </h1>
      <p className="text-muted-foreground text-lg mb-6 text-center">
        Explore companies, learn about their culture, and find where you want to work.
      </p>

      <div className="w-full max-w-4xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className="flex items-center h-14 rounded-full bg-card border border-gray-400 dark:border-gray-600"
        >
          {/* Filters Button */}
          {onOpenFilters && (
            <>
              <button
                type="button"
                onClick={onOpenFilters}
                className="relative flex items-center gap-2 px-5 py-2 text-sm font-medium 
                text-muted-foreground hover:text-foreground transition-colors rounded-l-full"
              >
                <SlidersHorizontal className="h-4 w-4 text-gray-500" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="absolute top-1 right-2 sm:static sm:ml-0.5 flex items-center
                   justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-[10px] font-semibold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <div className="w-px h-6 bg-gray-400" />
            </>
          )}

          {/* Keywords Input */}
          <div className="flex-1 flex items-center gap-2 px-4">
            <Search className="h-4 w-4 text-muted-foreground stroke-[1.5]" />
            <input
              type="text"
              placeholder="Company name / industry"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {/* Divider */}
               <div className="w-px h-6 bg-gray-400 dark:bg-gray-600 hidden sm:block" />

          {/* Location Input */}
          <div className="hidden sm:flex flex-1 items-center gap-2 px-4">
            <MapPin className="h-4 w-4 text-muted-foreground stroke-[1.5]" />
            <input
              type="text"
              placeholder="Location"
              value={locationQuery}
              onChange={(e) => onLocationChange?.(e.target.value)}
              className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {/* Search Button */}
          <button
            type="submit"
            aria-label="Search"
            className="flex items-center justify-center w-10 h-10 mr-2 rounded-full bg-orange-500 text-primary-foreground hover:bg-orange-400 transition-colors"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default DirectoryHeader;
