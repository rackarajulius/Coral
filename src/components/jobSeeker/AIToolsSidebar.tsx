import { useState } from 'react';
import { Sparkles, MessageSquareText, FileSearch, ChevronRight, Crown, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useProfile } from '@/contexts/ProfileContext';
import { getMyEntitlements } from '@/lib/api/entitlements';
import ProfileCompletion from './ProfileCompletion';
import RoleReadinessDialog from './RoleReadinessDialog';

const AIToolsSidebar = () => {
  const { profile, completionPercentage } = useProfile();
  const [readinessOpen, setReadinessOpen] = useState(false);
  const { data: entitlements } = useQuery({
    queryKey: ["entitlements"],
    queryFn: getMyEntitlements,
    staleTime: 60_000,
    retry: false,
  });
  const isPremium = entitlements?.tier === "premium";

  // Role context derived from the headline (e.g. "Senior Product Manager | ...").
  const primaryRole = profile.headline?.split('|')[0]?.trim() || 'your target';

  // A single, profile-aware "next best action" surfaced above the AI tools.
  const readinessMessage = (() => {
    if (profile.experiences.length === 0) {
      return 'Add work experience so our AI can tailor interview questions to your background.';
    }
    if (profile.skills.length < 5) {
      return `Add a few more skills to sharpen resume matches for ${primaryRole} roles.`;
    }
    if (completionPercentage < 80) {
      return `You're ${completionPercentage}% ready — completing your profile improves match accuracy.`;
    }
    return `Your profile looks recruiter-ready. Practice interviews for ${primaryRole} roles.`;
  })();

  return (
    <div className="space-y-4">
      {/* Profile Completion Card - with undo/redo/save */}
      <ProfileCompletion />

      {/* AI Career Tools — profile-aware deep links into the AI suite */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">AI career tools</h3>
        </div>

        {/* Profile-derived readiness tip */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 mb-4 border border-gray-200 dark:border-gray-600">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{readinessMessage}</p>
        </div>

        {/* Interview prep */}
        <Link
          to="/interview-prep"
          className="group flex items-center gap-3 p-3 mb-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all duration-200"
        >
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex-shrink-0">
            <MessageSquareText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Practice interviews</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Prep for {primaryRole} roles</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </Link>

        {/* Resume matcher */}
        <Link
          to="/resume-matcher"
          className="group flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-green-300 dark:hover:border-green-700 hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-all duration-200"
        >
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/30 flex-shrink-0">
            <FileSearch className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Match your resume</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">See how you score against a job</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </Link>

        {/* Role readiness */}
        <button
          onClick={() => setReadinessOpen(true)}
          className="group w-full flex items-center gap-3 p-3 mt-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all duration-200"
        >
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex-shrink-0">
            <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-gray-900 dark:text-white">Check role readiness</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Score your fit for {primaryRole}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </button>
      </div>

      <RoleReadinessDialog
        open={readinessOpen}
        onOpenChange={setReadinessOpen}
        defaultRole={primaryRole !== 'your target' ? primaryRole : ''}
      />

      {/* The resume export lives in the profile's own ⋯ menu, beside Edit
          profile, rather than in a card of its own down the rail. */}

      {/*
        Premium. This card used to promise "See who's viewed your profile" —
        which is free for everyone — behind a button with no action. It now
        says what Premium actually adds and goes somewhere real.
      */}
      <Link
        to="/premium"
        className="group block rounded-xl p-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 hover:shadow-md transition-shadow duration-300"
      >
        <div className="flex items-center gap-2 mb-2">
          <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span className="font-semibold text-gray-900 dark:text-white">
            {isPremium ? "You're on Premium" : "Premium"}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {isPremium
            ? "More interview practice and jobs from across the web. Manage your plan here."
            : "More AI interview practice, jobs from across the web, cover letters and resume tailoring."}
        </p>
        <span className="inline-flex items-center text-sm font-medium text-amber-700 dark:text-amber-400">
          {isPremium ? "Manage" : "See what's included"}
          <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </Link>
    </div>
  );
};

export default AIToolsSidebar;
