import { Search, MapPin, SlidersHorizontal } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/useAppDispatch";
import { setKeywords, setLocation, setFilterDrawerOpen } from "@/store/jobsSlice";

const SearchBar = () => {
  const dispatch = useAppDispatch();
  const { keywords, location } = useAppSelector((state) => state.jobs.filters);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4">
      <div
        className="flex items-center h-14 rounded-full bg-card border border-border"
      >
        {/* Filters Button */}
        <button
          onClick={() => dispatch(setFilterDrawerOpen(true))}
          className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-muted-foreground
           hover:text-foreground transition-colors rounded-l-full"
        >
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-400" />

        {/* Keywords Input */}
        <div className="flex-1 flex items-center gap-2 px-4">
          <Search className="h-4 w-4 text-muted-foreground stroke-[1.5]" />
          <input
            type="text"
            placeholder="Job title / keywords"
            value={keywords}
            onChange={(e) => dispatch(setKeywords(e.target.value))}
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-400 hidden sm:block" />

        {/* Location Input */}
        <div className="hidden sm:flex flex-1 items-center gap-2 px-4">
          <MapPin className="h-4 w-4 text-muted-foreground stroke-[1.5]" />
          <input
            type="text"
            placeholder="Location"
            value={location}
            onChange={(e) => dispatch(setLocation(e.target.value))}
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {/* Search Button */}
        <button className="flex items-center justify-center w-10 h-10 mr-2 rounded-full bg-orange-500
         text-primary-foreground hover:bg-orange-dark transition-colors">
          <Search className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default SearchBar;
