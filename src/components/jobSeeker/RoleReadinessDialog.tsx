import { useState } from 'react';
import { Target, Sparkles, Loader2, CheckCircle2, AlertTriangle, ArrowRight, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { analyzeRoleReadiness, type RoleReadiness } from '@/lib/api/jobSeekerProfile';

interface RoleReadinessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefilled target role (e.g. derived from the profile headline). */
  defaultRole?: string;
}

const scoreColor = (score: number) =>
  score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-600';

const barColor = (score: number) =>
  score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';

const RoleReadinessDialog = ({ open, onOpenChange, defaultRole = '' }: RoleReadinessDialogProps) => {
  const [role, setRole] = useState(defaultRole);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RoleReadiness | null>(null);

  const analyze = async () => {
    const target = role.trim();
    if (!target) {
      toast.error('Enter a target role first');
      return;
    }
    setLoading(true);
    try {
      const res = await analyzeRoleReadiness(target);
      setResult(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to analyze readiness');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => setResult(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Role readiness check
          </DialogTitle>
        </DialogHeader>

        {/* Input row */}
        <div className="space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Enter a role you're targeting. We'll score how ready your profile is and show
            exactly what to improve.
          </p>
          <div className="flex gap-2">
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value.slice(0, 120))}
              placeholder="e.g. Senior Product Manager"
              onKeyDown={(e) => e.key === 'Enter' && !loading && analyze()}
            />
            <Button
              onClick={analyze}
              disabled={loading}
              className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span className="ml-1.5">{result ? 'Re-run' : 'Analyze'}</span>
            </Button>
          </div>
        </div>

        {/* Loading */}
        {loading && !result && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-gray-400">
            <Loader2 className="w-7 h-7 animate-spin" />
            <p className="text-sm">Analyzing your profile against this role…</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-5 pt-1">
            {/* Score */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-end justify-between mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Readiness</span>
                <span className={`text-3xl font-bold ${scoreColor(result.score)}`}>
                  {result.score}
                  <span className="text-base font-medium text-gray-400">/100</span>
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div className={`h-full ${barColor(result.score)} transition-all`} style={{ width: `${result.score}%` }} />
              </div>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{result.verdict}</p>
            </div>

            {/* Strengths */}
            {result.strengths.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-green-600 mb-2">Strengths</p>
                <ul className="space-y-1.5">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Gaps */}
            {result.gaps.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">Gaps to close</p>
                <ul className="space-y-1.5">
                  {result.gaps.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing skills */}
            {result.missingSkills.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Skills to add</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.missingSkills.map((skill, i) => (
                    <Badge key={i} variant="secondary" className="font-normal">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested actions */}
            {result.suggestedActions.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">Next steps</p>
                <ol className="space-y-1.5">
                  {result.suggestedActions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {a}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex justify-between pt-1">
              <Button variant="ghost" size="sm" className="text-gray-500" onClick={reset}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Check another role
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>
                Done
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RoleReadinessDialog;
