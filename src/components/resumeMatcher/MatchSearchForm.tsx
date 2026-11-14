import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CityAutocomplete } from "@/components/location/CityAutocomplete";
import { anywherePlaceholder } from "@/lib/resumeMatcher/search";

/** The role and location boxes. The page owns their state and runs the search. */
export function MatchSearchForm({
  searchInput,
  locationInput,
  locationCountry,
  resultCountryCode,
  homeCountryCode,
  searching,
  disabled,
  onSearchChange,
  onLocationChange,
  onSubmit,
}: {
  searchInput: string;
  locationInput: string;
  /** The country of the city picked; none when the box was typed in freely. */
  locationCountry: string | undefined;
  /** The country the last search looked in. */
  resultCountryCode: string | undefined;
  /** The person's own country. */
  homeCountryCode: string | undefined;
  /** A search is running: the button shows a spinner. */
  searching: boolean;
  disabled: boolean;
  onSearchChange: (text: string) => void;
  onLocationChange: (text: string, countryCode?: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    // One bar: role | location | Search. On a phone the two boxes stack inside it.
    <form
      onSubmit={onSubmit}
      className="flex flex-col sm:flex-row sm:items-center w-full max-w-4xl mx-auto mb-3 rounded-3xl sm:rounded-full bg-card border border-gray-400 p-1 sm:pl-4"
    >
      <div className="flex sm:flex-[2] min-w-0 items-center h-9 px-3 sm:px-0 gap-2">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={2.5} aria-hidden="true" />
        <Input
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Role"
          placeholder="Search a role or leave blank to match your resume"
          className="border-0 bg-transparent px-0 h-auto shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="h-px mx-3 sm:h-6 sm:w-px bg-gray-400 shrink-0" aria-hidden="true" />
      <CityAutocomplete
        variant="inline"
        className="sm:flex-[2] min-w-0 px-3 sm:px-0"
        value={locationInput}
        near={locationCountry ?? resultCountryCode}
        // An empty box searches the country sent with it, or else the
        // person's own, so it names which.
        placeholder={anywherePlaceholder(locationCountry ?? homeCountryCode)}
        onChange={(text) => onLocationChange(text)}
        onSelect={(city) => onLocationChange(city.label, city.countryCode)}
      />
      <Button
        type="submit"
        variant="coral"
        className="rounded-full px-5 h-10 sm:h-9 sm:w-9 sm:px-0 sm:ml-2 shrink-0"
        disabled={disabled}
        aria-label={searching ? "Searching" : "Search"}
      >
        {searching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        )}
      </Button>
    </form>
  );
}
