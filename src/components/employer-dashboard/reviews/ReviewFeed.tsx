import React, { useMemo, useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { reviews } from '@/data/employer/reviews/reviews';
import { BadgeCheck, Filter, Flame, MessageSquare, Search, Star, Stars, ThumbsUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { cn } from '@/libs/utils';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

const ReviewFeed = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [filters, setFilters] = useState({ type: "all", rating: "all", sentiment: "all", responded: "all", dept: "all" });
    const filtered = useMemo(() => {
        return reviews.filter((r) => {
          if (activeTab === "respond" && r.responded) return false;
          if (activeTab === "flagged" && r.sentiment !== "negative") return false;
          if (filters.type !== "all" && r.type !== filters.type) return false;
          if (filters.rating !== "all" && r.rating !== Number(filters.rating)) return false;
          if (filters.sentiment !== "all" && r.sentiment !== filters.sentiment) return false;
          if (filters.responded === "yes" && !r.responded) return false;
          if (filters.responded === "no" && r.responded) return false;
          if (filters.dept !== "all" && r.department !== filters.dept) return false;
          if (searchQuery && !`${r.title} ${r.body} ${r.reviewer}`.toLowerCase().includes(searchQuery.toLowerCase())) return false;
          return true;
        });
      }, [activeTab, filters, searchQuery]);
      const [responseDialog, setResponseDialog] = useState<string | null>(null);
      const [responseText, setResponseText] = useState("");
      

      const submitResponse = () => {
          toast({ title: "Response published", description: "Your reply is now visible on the review." });
          setResponseDialog(null);
          setResponseText("");
        };

 function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={cn(
            "transition-colors",
            i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"
          )}
        />
      ))}
    </div>
  );
}
    
  function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
        return (
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
              {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
            </div>
            {action}
          </div>
        );
      };

 function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
                  return (
                    <div className={cn("rounded-xl border border-border bg-card", className)}>{children}</div>
                  );
                };
      
  return (
   <section className='mt-6'>
             <SectionHeader
               title="Review Feed"
               description={`${filtered.length} of ${reviews.length} reviews`}
             />
   
             {/* Sticky filter bar */}
             <div className=" top-16 z-20 -mx-2 px-2 py-3 bg-card backdrop-blur-md border-b border-border mb-4">
               <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-3">
                 <TabsList className="h-9">
                   <TabsTrigger value="all" className="text-xs">All Reviews</TabsTrigger>
                   <TabsTrigger value="respond" className="text-xs">Needs Response</TabsTrigger>
                   <TabsTrigger value="flagged" className="text-xs">Negative</TabsTrigger>
                   <TabsTrigger value="trending" className="text-xs">Trending</TabsTrigger>
                 </TabsList>
               </Tabs>
               <div className="flex flex-wrap items-center gap-2">
                 <div className="relative flex-1 min-w-[200px]">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                   <Input
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     placeholder="Search reviews..."
                     className="pl-9 h-9 bg-card border-border"
                   />
                 </div>
                 {([
                   ["type", "Reviewer", ["all", "Current Employee", "Former Employee", "Candidate", "Interviewee", "Contractor", "Intern"]],
                   ["rating", "Rating", ["all", "5", "4", "3", "2", "1"]],
                   ["sentiment", "Sentiment", ["all", "positive", "neutral", "negative"]],
                   ["responded", "Response", ["all", "yes", "no"]],
                   ["dept", "Department", ["all", "Engineering", "Product", "Design", "Sales", "Marketing", "Customer Support"]],
                 ] as const).map(([key, label, opts]) => (
                   <Select key={key} value={filters[key]} onValueChange={(v) => setFilters({ ...filters, [key]: v })}>
                     <SelectTrigger className="h-9 w-auto min-w-[120px] text-xs bg-card">
                       <SelectValue placeholder={label} />
                     </SelectTrigger>
                     <SelectContent>
                       {opts.map((o) => (
                         <SelectItem key={o} value={o} className="text-xs capitalize">
                           {o === "all" ? `All ${label}` : o === "yes" ? "Responded" : o === "no" ? "Not responded" : o}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 ))}
                 <Button variant="outline" size="sm" className="h-9 gap-2"><Filter className="h-3.5 w-3.5" />Saved</Button>
               </div>
             </div>
   
             {/* Reviews */}
             <div className="space-y-3">
               {filtered.map((r) => (
                 <Panel key={r.id} className="p-5 hover:shadow-card transition-shadow">
                   <div className="flex items-start justify-between gap-4 flex-wrap">
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                         <Badge variant="outline" className="font-medium bg-amber-500/10 border-amber-500/30 text-amber-700">{r.type}</Badge>
                         <span>·</span>
                         <span>{r.department}</span>
                         <span>·</span>
                         <span>{r.location}</span>
                         <span>·</span>
                         <span>{r.tenure}</span>
                         <span>·</span>
                         <span>{r.date}</span>
                         {r.verified && (
                           <span className="flex items-center gap-1 text-emerald-600 font-medium">
                             <BadgeCheck className="h-3 w-3" /> Verified
                           </span>
                         )}
                         {r.trending && (
                           <span className="flex items-center gap-1 text-accent font-medium">
                             <Flame className="h-3 w-3" /> Trending
                           </span>
                         )}
                       </div>
                       <div className="flex items-center gap-3 mt-2">
                         <Stars value={r.rating} size={14} />
                         <span className="text-xs font-medium tabular-nums">{r.rating}.0</span>
                       </div>
                       <h3 className="text-base font-semibold tracking-tight text-foreground mt-2">{r.title}</h3>
                       <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{r.body}</p>
   
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                         <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
                           <p className="text-[11px] uppercase tracking-wider font-medium text-emerald-700 mb-1">Pros</p>
                           <p className="text-sm text-foreground/80">{r.pros}</p>
                         </div>
                         <div className="rounded-lg bg-rose-500/5 border border-rose-500/20 p-3">
                           <p className="text-[11px] uppercase tracking-wider font-medium text-rose-700 mb-1">Cons</p>
                           <p className="text-sm text-foreground/80">{r.cons}</p>
                         </div>
                       </div>
   
                       <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mt-4">
                         {Object.entries(r.categories).map(([k, v]) => (
                           <div key={k} className="flex items-center gap-2 text-xs">
                             <span className="text-muted-foreground w-24 truncate">{k}</span>
                             <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                               <div className="h-full bg-foreground/70" style={{ width: `${(v / 5) * 100}%` }} />
                             </div>
                             <span className="font-medium tabular-nums w-6 text-right">{v}.0</span>
                           </div>
                         ))}
                       </div>
   
                       <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                         <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                           <ThumbsUp className="h-3 w-3" /> Helpful · {r.helpful}
                         </button>
                         <span>·</span>
                         <span>{r.reviewer}</span>
                       </div>
                     </div>
   
                     <div className="flex flex-col gap-2 shrink-0">
                       {r.responded ? (
                         <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-emerald-700 justify-center">
                           Responded
                         </Badge>
                       ) : (
                         <Badge variant="default" className="bg-amber-500/10 border-amber-500/30 text-amber-700 justify-center">
                           Needs Response
                         </Badge>
                       )}
                       <Button size="sm" variant={r.responded ? "outline" : "default"} className="gap-2" onClick={() => setResponseDialog(r.id)}>
                         <MessageSquare className="h-3.5 w-3.5" />
                         {r.responded ? "Edit Response" : "Respond"}
                       </Button>
                       <Button size="sm" variant="destructive" className="text-xs">Flag</Button>
                     </div>
                   </div>
                 </Panel>
               ))}
               {filtered.length === 0 && (
                 <Panel className="p-12 text-center">
                   <p className="text-sm text-muted-foreground">No reviews match your filters.</p>
                 </Panel>
               )}
             </div>
           </section>
  );
};

export default ReviewFeed;
