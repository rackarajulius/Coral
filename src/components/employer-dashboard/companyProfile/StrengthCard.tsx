import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function StrengthCard({ strength }: { strength: number }) {
  const tone =
    strength >= 90 ? "Outstanding" : strength >= 75 ? "Strong" : strength >= 50 ? "Good start" : "Keep going";
  return (
    <div className="dashboard-section !p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Profile strength</p>
        <span className="text-xs font-medium text-foreground">{tone}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold">{strength}</span>
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={false}
          animate={{ width: `${strength}%` }}
          transition={{ duration: 0.4 }}
          className={cn(
            "h-full rounded-full bg-gradient-to-r",
            strength >= 75 ? "from-emerald-500 to-emerald-400" : "from-accent to-coral-light"
          )}
        />
      </div>
    </div>
  );
}
