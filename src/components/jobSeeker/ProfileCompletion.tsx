import { COMPLETION_CHECKS, useProfile } from '@/contexts/ProfileContext';
import { CheckCircle2, Circle, Undo2, Redo2, Save, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProfileCompletionProps {
  showActions?: boolean;
}

const ProfileCompletion = ({ showActions = true }: ProfileCompletionProps) => {
  const {
    profile,
    completionPercentage,
    isSaving,
    lastSaved,
    canUndo,
    canRedo,
    undo,
    redo,
    saveProfile,
    isAuthenticated,
    syncError,
  } = useProfile();

  // Every check the percentage is made of, so the list can never again show
  // fewer items than the bar is scoring.
  const sections = COMPLETION_CHECKS.map((c) => ({
    name: c.label,
    completed: c.check(profile),
  }));

  /**
   * A finished profile does not need a progress card.
   *
   * It goes away at 100% rather than sitting there saying "complete" forever —
   * the card exists to point at what is missing. The one exception is a failed
   * save: that is not a nudge, it is news, and hiding it would mean nobody
   * learns their edits never landed.
   */
  if (completionPercentage === 100 && !syncError) return null;

  const getCompletionColor = () => {
    if (completionPercentage >= 80) return 'text-green-600 dark:text-green-400';
    if (completionPercentage >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getProgressColor = () => {
    if (completionPercentage >= 80) return 'bg-green-500';
    if (completionPercentage >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const formatLastSaved = () => {
    if (!lastSaved) return 'Not saved yet';
    const now = new Date();
    const diff = now.getTime() - lastSaved.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (seconds < 10) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    return lastSaved.toLocaleTimeString();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-300">
      {/* Header with percentage */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Profile Completion</h3>
        <span className={`text-lg font-bold ${getCompletionColor()}`}>
          {completionPercentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative mb-3">
        <Progress value={completionPercentage} className="h-2" />
        <div 
          className={`absolute top-0 left-0 h-2 rounded-full transition-all duration-500 ${getProgressColor()}`}
          style={{ width: `${completionPercentage}%` }}
        />
      </div>

      {/* Sections checklist */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {sections.map((section) => (
          <div 
            key={section.name}
            className="flex items-center gap-1.5 text-xs"
          >
            {section.completed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            )}
            <span className={`truncate ${section.completed ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {section.name}
            </span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      {showActions && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={undo}
                    disabled={!canUndo}
                    aria-label="Undo"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Undo</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={redo}
                    disabled={!canRedo}
                    aria-label="Redo"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Redo</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center gap-2">
            {isSaving ? (
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </div>
            ) : syncError ? (
              <div className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400" title={syncError}>
                <AlertCircle className="w-3 h-3" />
                Couldn't save
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Save className="w-3 h-3" />
                {formatLastSaved()}
              </div>
            )}
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={saveProfile}
                    disabled={isSaving}
                  >
                    Save
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isAuthenticated ? 'Save to your account' : 'Save to browser'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}

      {/* Motivational message */}
      {completionPercentage < 100 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
          {completionPercentage < 50 
            ? 'Complete your profile to increase visibility'
            : "You're almost there!"}
        </p>
      )}

    </div>
  );
};

export default ProfileCompletion;
