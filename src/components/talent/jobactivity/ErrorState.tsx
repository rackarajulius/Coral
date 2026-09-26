import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { TABS, type TabId } from './constants';

const ErrorState = ({ tab, onRetry }: { tab: TabId; onRetry: () => void }) => {
    const label = TABS.find((t) => t.id === tab)?.label.toLowerCase() ?? "this section";

  return (
   <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 animate-fade-in" role="alert">
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-full blur-2xl" style={{ background: "rgba(220,38,38,0.08)" }} />
        <div className="w-20 h-20 rounded-full border-2 border-[#FECACA] bg-white flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-[#DC2626]" />
        </div>
      </div>
      <h2
        className="mt-8 text-lg font-bold text-[#1F2937]"
        style={{ letterSpacing: "-0.03em", lineHeight: 1.15 }}
      >
        We couldn't load your {label}
      </h2>
      <p className="mt-3 text-sm text-[#6B7280] max-w-[520px]" style={{ lineHeight: 1.7 }}>
        Something went wrong on our side. Please check your connection and try again — your data is safe.
      </p>
      <div className="mt-3 inline-flex items-center gap-2 text-xs text-[#9CA3AF]">
        <WifiOff className="w-3.5 h-3.5" /> Error code: <span className="font-mono">JA-{tab.toUpperCase()}-503</span>
      </div>
      <div className="mt-7 flex items-center gap-3">
        <Button size="lg" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
        <Button size="lg" variant="outline" onClick={() => window.location.reload()}>Reload page</Button>
      </div>
    </div>
  );
};

export default ErrorState;
