import { createContext, useContext, useState, type ReactNode } from "react";

type Range = 7 | 30 | 90;
const Context = createContext<{ days: Range; setDays: (days: Range) => void } | null>(null);

export function AnalyticsRangeProvider({ children }: { children: ReactNode }) {
  const [days, setDays] = useState<Range>(30);
  return <Context.Provider value={{ days, setDays }}>{children}</Context.Provider>;
}

export function useAnalyticsRange() {
  const context = useContext(Context);
  if (!context) throw new Error("AnalyticsRangeProvider is missing");
  return context;
}
