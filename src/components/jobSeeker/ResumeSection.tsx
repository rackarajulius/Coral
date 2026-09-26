import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ExternalLink, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import {
  deleteMyResumeFile, getMyResumeFile, getStoredResumeSummary, parseResume,
  type ParsedResume,
} from '@/lib/api/jobSeekerProfile';
import { ResumeImportDialog } from './ResumeImportDialog';
import { useProfile } from '@/contexts/ProfileContext';
import { takeStashedResumeImport } from '@/lib/resumeImportStash';

/** Matches the server's own limit, so the refusal happens before the upload. */
const MAX_SIZE = 10 * 1024 * 1024;

/**
 * The resume, somewhere it can actually be managed.
 *
 * Everything behind this already worked — the file is stored privately, the
 * parse feeds job matches and the interview coach, and a new upload replaces
 * the old file rather than piling up. What was missing was anywhere to see it.
 * Someone who skipped the optional upload at onboarding had no route to add one
 * later except starting an interview setup, and nobody could tell whether the
 * resume on file was still current.
 *
 * On the profile and not in Settings: this is a document employers receive, not
 * a preference about how the app behaves.
 *
 * Deliberately absent from the public profile — recruiters get the file through
 * an application, which is consent-gated. A download link on a page anyone can
 * open would hand it to everyone.
 */
const ResumeSection = () => {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** What the last upload read, held for the review dialog. */
  const [parsed, setParsed] = useState<ParsedResume | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const { isLoading: profileLoading } = useProfile();

  /**
   * Picks up a parse left by onboarding.
   *
   * Waits for the profile to finish loading first: adding an experience before
   * hydration completes keeps it in local state only, and it would be lost on
   * the next refresh. Taken once — a page refresh does not ask again.
   */
  useEffect(() => {
    if (profileLoading) return;
    const stashed = takeStashedResumeImport();
    if (stashed) {
      setParsed(stashed);
      setReviewOpen(true);
    }
  }, [profileLoading]);

  const file = useQuery({ queryKey: ['my-resume-file'], queryFn: getMyResumeFile, retry: false });
  const summary = useQuery({
    queryKey: ['my-resume-summary'],
    queryFn: getStoredResumeSummary,
    retry: false,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['my-resume-file'] });
    void queryClient.invalidateQueries({ queryKey: ['my-resume-summary'] });
  };

  const upload = useMutation({
    mutationFn: (chosen: File) => parseResume(chosen),
    onSuccess: (result) => {
      refresh();
      toast.success('Resume saved');
      // Straight into review: the file is stored either way, and what it says
      // about your history is a separate, opt-in decision.
      setParsed(result);
      setReviewOpen(true);
    },
    onError: (e) => {
      // The file may well have been saved even though reading it failed, so
      // the card is refreshed before the message is shown — otherwise it would
      // say "No resume yet" about a resume that is now on file.
      refresh();
      // Verbatim: the server distinguishes "could not read this file" from
      // "the reader is down", and both matter to what you do next.
      toast.error((e as Error).message);
    },
  });

  const remove = useMutation({
    mutationFn: deleteMyResumeFile,
    onSuccess: () => {
      refresh();
      setConfirmDelete(false);
      toast.success('Resume removed');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const choose = (chosen: File | undefined) => {
    if (!chosen) return;
    if (chosen.size > MAX_SIZE) {
      toast.error('That file is over 10MB. Try exporting it again as a PDF.');
      return;
    }
    upload.mutate(chosen);
  };

  const busy = upload.isPending;
  const stored = file.data?.fileName ? file.data : null;
  const loading = file.isLoading || summary.isLoading;

  return (
    <section
      id="resume"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow duration-300 scroll-mt-24"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Resume</h2>
        </div>

        {stored && !loading && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Reading…</>
              ) : (
                <><Upload className="w-3.5 h-3.5 mr-1.5" /> Replace</>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remove resume"
              className="h-8 w-8 text-gray-500 hover:text-red-600 dark:text-gray-400"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {loading && <Skeleton className="h-20 rounded-lg" />}

      {!loading && stored && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
          <p className="font-medium text-gray-900 dark:text-white break-all">{stored.fileName}</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {stored.uploadedAt
              ? `Uploaded ${new Date(stored.uploadedAt).toLocaleDateString(undefined, {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}`
              : 'Uploaded'}
            {/* The extracted counts, because that is what actually drives
                matching — not whether a file exists. */}
            {summary.data && (
              <>
                {' · '}
                {summary.data.skills.length} skill{summary.data.skills.length === 1 ? '' : 's'} read
                {summary.data.experienceYears > 0 && ` · ${summary.data.experienceYears} yrs experience`}
              </>
            )}
          </p>

          {stored.url && (
            <a
              href={stored.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-coral hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              Preview
            </a>
          )}

          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Sent with every application unless you attach a different one for that job.
          </p>
        </div>
      )}

      {!loading && !stored && (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center">
          <p className="text-sm font-medium text-gray-900 dark:text-white">No resume yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            Adding one sharpens your job matches, gives the interview coach your real background
            to ask about, and goes with every application you send.
          </p>
          <Button className="mt-4" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reading…</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" /> Upload resume</>
            )}
          </Button>
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            PDF, DOC, DOCX or TXT, up to 10MB
          </p>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        aria-label="Upload resume"
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          // Cleared first: picking the same file twice fires no change event.
          e.target.value = '';
          choose(chosen);
        }}
      />

      <ResumeImportDialog
        parsed={parsed}
        open={reviewOpen}
        onOpenChange={(next) => {
          setReviewOpen(next);
          if (!next) setParsed(null);
        }}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove your resume?</AlertDialogTitle>
            <AlertDialogDescription>
              The file is deleted, along with the skills and roles read from it. Applications you
              already sent keep the copy they were sent with, and the rest of your profile is
              untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                remove.mutate();
              }}
            >
              {remove.isPending ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

export default ResumeSection;
