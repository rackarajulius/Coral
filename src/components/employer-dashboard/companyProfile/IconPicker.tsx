import { useState, useMemo } from "react";
import type { LucideIcon as LI } from "lucide-react";
import { Search, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ICON_MAP } from "./icon-registry";

export const ICON_LIBRARY: { name: string; keywords: string }[] = [
  { name: "Heart", keywords: "health wellness love care" },
  { name: "HeartPulse", keywords: "health medical pulse" },
  { name: "Activity", keywords: "fitness pulse health" },
  { name: "Dumbbell", keywords: "fitness gym workout health" },
  { name: "Bike", keywords: "fitness commute" },
  { name: "Stethoscope", keywords: "health medical doctor" },
  { name: "Pill", keywords: "health medicine pharmacy" },
  { name: "Apple", keywords: "food nutrition health snack" },
  { name: "Coffee", keywords: "drink perk break" },
  { name: "Utensils", keywords: "food lunch meal" },
  { name: "Brain", keywords: "mental wellness mind learning" },
  { name: "Smile", keywords: "wellness happy" },
  { name: "Sun", keywords: "wellness mood light" },
  { name: "Moon", keywords: "sleep night rest" },
  { name: "DollarSign", keywords: "money salary financial pay" },
  { name: "Banknote", keywords: "money cash financial salary" },
  { name: "PiggyBank", keywords: "savings retirement 401k financial" },
  { name: "Wallet", keywords: "money financial pay" },
  { name: "TrendingUp", keywords: "growth equity stock financial" },
  { name: "LineChart", keywords: "stats financial growth" },
  { name: "Coins", keywords: "money financial bonus" },
  { name: "Gift", keywords: "perk bonus reward" },
  { name: "Award", keywords: "recognition prize bonus" },
  { name: "Trophy", keywords: "achievement recognition" },
  { name: "GraduationCap", keywords: "learning education growth training" },
  { name: "BookOpen", keywords: "learning book education growth" },
  { name: "Book", keywords: "learning education" },
  { name: "Library", keywords: "learning resources" },
  { name: "Lightbulb", keywords: "idea learning innovation" },
  { name: "Compass", keywords: "growth direction mentor" },
  { name: "Target", keywords: "goals okrs growth" },
  { name: "Rocket", keywords: "growth career launch" },
  { name: "Home", keywords: "remote work from home" },
  { name: "House", keywords: "remote home" },
  { name: "Laptop", keywords: "remote work device equipment" },
  { name: "Monitor", keywords: "equipment workspace setup" },
  { name: "Wifi", keywords: "remote internet stipend" },
  { name: "Globe", keywords: "remote global work-anywhere" },
  { name: "Plane", keywords: "travel relocation offsite" },
  { name: "Map", keywords: "travel location" },
  { name: "MapPin", keywords: "location office" },
  { name: "Calendar", keywords: "pto time off vacation" },
  { name: "CalendarDays", keywords: "time off pto schedule" },
  { name: "CalendarHeart", keywords: "parental leave family time" },
  { name: "Clock", keywords: "time hours flexible" },
  { name: "Hourglass", keywords: "time flexible" },
  { name: "Timer", keywords: "time work hours" },
  { name: "Baby", keywords: "parental family child leave" },
  { name: "Users", keywords: "team people community" },
  { name: "UserCheck", keywords: "team mentor hire" },
  { name: "HandHeart", keywords: "volunteer giving impact" },
  { name: "Handshake", keywords: "team partnership" },
  { name: "Sparkles", keywords: "perk magic delight" },
  { name: "Star", keywords: "featured top perk" },
  { name: "Zap", keywords: "energy fast perk" },
  { name: "Flame", keywords: "hot featured" },
  { name: "Shield", keywords: "insurance safety security" },
  { name: "ShieldCheck", keywords: "insurance coverage protected" },
  { name: "Umbrella", keywords: "insurance coverage" },
  { name: "Tent", keywords: "offsite retreat outdoor" },
  { name: "Mountain", keywords: "offsite retreat adventure" },
  { name: "TreePalm", keywords: "vacation tropical pto" },
  { name: "PartyPopper", keywords: "celebration event perk" },
  { name: "Music", keywords: "perk fun event" },
  { name: "Gamepad2", keywords: "fun games perk" },
  { name: "Dog", keywords: "pet friendly perk" },
  { name: "Cat", keywords: "pet friendly perk" },
  { name: "Bus", keywords: "commute transport" },
  { name: "Car", keywords: "commute transport stipend" },
  { name: "Train", keywords: "commute transport" },
  { name: "Building", keywords: "office workspace" },
  { name: "Building2", keywords: "office workspace company" },
  { name: "Briefcase", keywords: "work job career" },
  { name: "Headphones", keywords: "equipment focus deep-work" },
  { name: "Mic", keywords: "podcast event speak" },
  { name: "Camera", keywords: "media event" },
  { name: "Palette", keywords: "design creative" },
  { name: "Code", keywords: "engineering tech" },
  { name: "Wrench", keywords: "tools engineering" },
  { name: "Hammer", keywords: "build tools" },
  { name: "FlaskConical", keywords: "research lab science" },
  { name: "Microscope", keywords: "research science" },
  { name: "Leaf", keywords: "sustainability green wellness" },
  { name: "TreePine", keywords: "sustainability green nature" },
  { name: "Recycle", keywords: "sustainability green" },
  { name: "Earth", keywords: "global sustainability" },
  { name: "Languages", keywords: "language learning translate" },
  { name: "Accessibility", keywords: "dei inclusion accessibility" },
  { name: "UsersRound", keywords: "dei team inclusion" },
];

export function Icon({ name, className }: { name?: string; className?: string }) {
  if (!name) return null;
  const Cmp = ICON_MAP[name] as LI | undefined;
  if (!Cmp) return <span className={className}>{name}</span>;
  return <Cmp className={className} />;
}

interface IconPickerProps {
  value?: string;
  onChange: (name: string) => void;
  triggerClassName?: string;
  size?: "sm" | "md";
}

export function IconPicker({ value, onChange, triggerClassName, size = "md" }: IconPickerProps) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ICON_LIBRARY;
    return ICON_LIBRARY.filter(
      (i) => i.name.toLowerCase().includes(s) || i.keywords.includes(s)
    );
  }, [q]);

  const dim = size === "sm" ? "w-9 h-9" : "w-10 h-10";
  const iconDim = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded-lg bg-muted hover:bg-secondary border border-border flex items-center justify-center transition-colors text-foreground",
            dim,
            triggerClassName
          )}
        >
          {value ? (
            <Icon name={value} className={iconDim} />
          ) : (
            <Smile className={cn(iconDim, "text-muted-foreground")} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search icons…"
            className="pl-8 h-8 text-xs"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-7 gap-1 max-h-56 overflow-y-auto pr-1">
          {filtered.map((i) => {
            const active = value === i.name;
            return (
              <button
                key={i.name}
                type="button"
                title={i.name}
                onClick={() => {
                  onChange(i.name);
                  setOpen(false);
                }}
                className={cn(
                  "aspect-square rounded-md flex items-center justify-center transition-colors",
                  active ? "bg-accent/15 text-accent" : "hover:bg-muted text-foreground"
                )}
              >
                <Icon name={i.name} className="w-4 h-4" />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-7 text-xs text-muted-foreground py-4 text-center">No icons match.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
