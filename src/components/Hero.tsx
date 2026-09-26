import { Search, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { setKeywords, setLocation } from "@/store/jobsSlice";
import { useState } from "react";

const Hero = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchKeywords, setSearchKeywords] = useState("");
  const [searchLocation, setSearchLocation] = useState("");

  const handleSearch = () => {
    dispatch(setKeywords(searchKeywords));
    dispatch(setLocation(searchLocation));
    navigate("/jobs");
  };

  return (
    <section className="relative min-h-screen flex items-center bg-background overflow-hidden">

      <div className="container mx-auto px-4 md:px-12 lg:px-24 pt-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6 animate-fade-in-up">
          Find Your Dream Job
          <span className="block text-accent">Today</span>
         </h1>

          <p className="text-muted-foreground text-lg md:text-xl mb-10 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
           We connect talented people with meaningful opportunities at leading
           companies, NGOs, and remote teams around the world.
         </p>

          {/* Neumorphic Search Box */}
            <div className="flex items-center h-14 bg-card border border-border rounded-full">
              {/* Keywords Input */}
              <div className="flex-1 flex items-center gap-2 px-4 pl-6">
                <Search className="h-4 w-4 text-muted-foreground stroke-[1.5]" />
                <input
                  type="text"
                  placeholder="Job title / keywords"
                  value={searchKeywords}
                  onChange={(e) => setSearchKeywords(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                />
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-border hidden sm:block" />

              {/* Location Input */}
              <div className="hidden sm:flex flex-1 items-center gap-2 px-4">
                <MapPin className="h-4 w-4 text-muted-foreground stroke-[1.5]" />
                <input
                  type="text"
                  placeholder="Location"
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                />
              </div>

              {/* Search Button */}
              <button 
                onClick={handleSearch}
                className="flex items-center justify-center w-10 h-10 mr-2 rounded-full bg-accent
                 text-primary-foreground hover:bg-coral-dark transition-colors"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-2 mt-6 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <span className="text-sm text-muted-foreground">Popular:</span>
          {["Remote", "Full-time", "Tech", "Marketing", "Design"].map((tag) => (
            <button
              key={tag}
              className="text-sm text-foreground bg-secondary hover:bg-muted px-3 py-1 rounded-full transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
