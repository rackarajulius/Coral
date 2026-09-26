import { useState, useRef, useEffect } from 'react';
import { Play, Edit3, Send, MapPin, Briefcase, MoreHorizontal, Eye, TrendingUp, ShieldCheck, BadgeCheck, Clock, ShieldAlert, Flag, Loader2, Video, Pencil, Trash2, Camera, X, FileText, Sparkles, Download, ExternalLink, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import VideoModel from './VideoModel';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { getWorkEligibilityOption } from '@/lib/workEligibility';
import { uploadBanner, uploadIntroVideo, deleteBanner, suggestHeadlines, getProfileStats } from '@/lib/api/jobSeekerProfile';
import {
  listMyVerifications,
  requestVerification,
  uploadVerificationDocument,
  statusForType,
  type Verification,
  type VerificationStatus,
} from '@/lib/api/verifications';
import { ProfileAvatar, ProfileBanner } from '@/components/jobSeeker/ProfileVisuals';
import { ProfileViewersDialog } from '@/components/jobSeeker/ProfileViewersDialog';
import { exportResumePdf, hasResumeContent } from '@/lib/resumePdf';

const ProfileHero = () => {
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const { profile, updateProfileInfo } = useProfile();
  const { user } = useAuth();

  /**
   * The uploaded photo, else the one the account already has.
   *
   * Signing in with Google hands us a profile picture; ignoring it meant
   * showing initials to someone whose photo we were holding. An uploaded
   * avatar always wins.
   */
  const avatarSrc = profile.avatarUrl || user?.avatarUrl || undefined;

  /**
   * Real counts, or nothing.
   *
   * Two invented numbers used to live in this bar — "847 profile views" and
   * "23 search appearances", identical on every account. These are measured:
   * one view per viewer per day, and one appearance each time an employer's
   * candidate search actually returned you.
   */
  const stats = useQuery({
    queryKey: ['profile-stats'],
    queryFn: getProfileStats,
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: false,
  });

  /** Builds the resume PDF from what is on the profile right now. */
  const handleSavePdf = () => {
    try {
      exportResumePdf(profile, { email: user?.email });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not build the PDF');
    }
  };
  const navigate = useNavigate();
  const { uploading: uploadingAvatar, upload: uploadAvatarFile, remove: removeAvatar } = useAvatarUpload();

  // Identity verification — real state driven by GET /verifications/me.
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [verifyNote, setVerifyNote] = useState('');
  const [verifyFile, setVerifyFile] = useState<File | null>(null);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const verifyFileRef = useRef<HTMLInputElement>(null);

  const identityStatus: VerificationStatus | null = statusForType(verifications, 'IDENTITY');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listMyVerifications()
      .then((list) => { if (!cancelled) setVerifications(list); })
      .catch(() => { /* best-effort: badge falls back to "Get Verified" */ });
    return () => { cancelled = true; };
  }, [user]);

  const handleVerifyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) return toast.error('Upload a PNG, JPG, WebP, or PDF');
    if (file.size > 10 * 1024 * 1024) return toast.error('Document must be under 10MB');
    setVerifyFile(file);
  };

  const handleSubmitVerification = async () => {
    setSubmittingVerification(true);
    try {
      // Upload the document to the private bucket first (if one was attached),
      // then submit the request referencing its storage path.
      const documentUrl = verifyFile ? await uploadVerificationDocument(verifyFile) : undefined;
      await requestVerification({ type: 'IDENTITY', note: verifyNote.trim() || undefined, documentUrl });
      const list = await listMyVerifications();
      setVerifications(list);
      setIsVerifyOpen(false);
      setVerifyNote('');
      setVerifyFile(null);
      toast.success('Verification request submitted', {
        description: 'Our team will review it shortly.',
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit verification');
    } finally {
      setSubmittingVerification(false);
    }
  };

  const publicProfilePath = `/profile/${user?.id ?? 'me'}`;
  const eligibility = getWorkEligibilityOption(profile.workEligibility);

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const dialogAvatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Edit Profile dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editHeadline, setEditHeadline] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editOpenToWork, setEditOpenToWork] = useState(false);

  // AI headline suggestions
  const [headlineSuggestions, setHeadlineSuggestions] = useState<string[]>([]);
  const [loadingHeadlines, setLoadingHeadlines] = useState(false);

  const openEditModal = () => {
    setEditName(profile.name);
    setEditHeadline(profile.headline);
    setEditLocation(profile.location);
    setEditOpenToWork(profile.openToWork);
    setHeadlineSuggestions([]);
    setIsEditOpen(true);
  };

  const handleSuggestHeadlines = async () => {
    setLoadingHeadlines(true);
    try {
      const list = await suggestHeadlines();
      setHeadlineSuggestions(list);
      if (list.length === 0) {
        toast.info('No suggestions yet — add more detail to your profile and try again.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate headlines');
    } finally {
      setLoadingHeadlines(false);
    }
  };

  const handleSaveProfile = () => {
    updateProfileInfo({
      name: editName.trim() || profile.name,
      headline: editHeadline.trim(),
      location: editLocation.trim(),
      openToWork: editOpenToWork,
    });
    setIsEditOpen(false);
    toast.success('Profile updated');
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    uploadAvatarFile(file);
  };

  const handleBannerSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please choose an image file');
    if (file.size > 5 * 1024 * 1024) return toast.error('Banner must be under 5MB');

    setUploadingBanner(true);
    try {
      const url = await uploadBanner(file);
      updateProfileInfo({ bannerUrl: url });
      toast.success('Banner updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload banner');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) return toast.error('Please choose a video file');
    if (file.size > 50 * 1024 * 1024) return toast.error('Video must be under 50MB');

    setUploadingVideo(true);
    try {
      const url = await uploadIntroVideo(file);
      updateProfileInfo({ introVideoUrl: url });
      toast.success('Intro video updated');
      setIsVideoOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload video');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleBannerDelete = async () => {
    if (!profile.bannerUrl) return;
    setUploadingBanner(true);
    try {
      await deleteBanner();
      updateProfileInfo({ bannerUrl: undefined });
      toast.success('Banner removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove banner');
    } finally {
      setUploadingBanner(false);
    }
  };

  // Play the intro video if one exists, otherwise prompt an upload.
  const handleVideoButtonClick = () => {
    if (uploadingVideo) return;
    if (profile.introVideoUrl) setIsVideoOpen(true);
    else videoInputRef.current?.click();
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${publicProfilePath}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${profile.name} — ProHire`, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Profile link copied', {
        description: 'Share it with recruiters.',
        action: { label: 'View', onClick: () => navigate(publicProfilePath) },
      });
    } catch {
      // Native share dismissed — nothing to report.
    }
  };

  return (
    <section className="relative w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 rounded-xl ">
      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow duration-300">
        {/* Banner Image */}
        <div className="relative h-40 sm:h-48 md:h-56 w-full overflow-hidden bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <ProfileBanner bannerUrl={profile.bannerUrl} />

          {/* Banner options menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={uploadingBanner}
                aria-label="Banner options"
                className="absolute top-3 right-3 z-10 p-2 rounded-full bg-card dark:bg-gray-800/95 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-700 shadow-md hover:shadow-lg transition-all duration-200 group disabled:opacity-70"
              >
                {uploadingBanner ? (
                  <Loader2 className="w-4 h-4 text-gray-700 dark:text-gray-200 animate-spin" />
                ) : (
                  <MoreHorizontal className="w-4 h-4 text-gray group-hover:text-gray-800 dark:group-hover:text-white" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => bannerInputRef.current?.click()}>
                <Pencil className="w-4 h-4 mr-2" />
                {profile.bannerUrl ? 'Edit banner' : 'Add banner'}
              </DropdownMenuItem>
              {profile.bannerUrl && (
                <DropdownMenuItem
                  onClick={handleBannerDelete}
                  className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete banner
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleBannerSelect}
            className="hidden"
            aria-label="Upload banner image"
          />

          {/* Decorative overlay (non-interactive so it doesn't swallow button clicks) */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none" />
        </div>

        {/* Profile Info Container */}
        <div className="relative -mt-12 sm:-mt-14 px-6 pb-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center sm:items-start">
            <div className="relative group">
              {/* Profile Photo */}
              <div className="w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full ring-4 ring-white dark:ring-gray-800 shadow-lg overflow-hidden">
                <ProfileAvatar
                  name={profile.name}
                  avatarUrl={avatarSrc}
                  className="w-full h-full"
                  textClassName="text-3xl"
                />
              </div>
              
              {/* Video Play / Upload Button */}
              <button
                onClick={handleVideoButtonClick}
                disabled={uploadingVideo}
                aria-label={profile.introVideoUrl ? 'Play intro video' : 'Upload intro video'}
                title={profile.introVideoUrl ? 'Play intro video' : 'Add a 30-second intro video'}
                className="absolute bottom-1 right-1 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 disabled:opacity-70"
              >
                {uploadingVideo ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : profile.introVideoUrl ? (
                  <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
                ) : (
                  <Video className="w-4 h-4 text-white" />
                )}
              </button>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleVideoSelect}
                className="hidden"
                aria-label="Upload introduction video"
              />

              {/* Online indicator */}
              <div className="absolute bottom-2 left-2 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
            </div>
          </div>

          {/* Intro video helper / replace control */}
          <div className="mt-2 flex justify-center sm:justify-start">
            <button
              onClick={() => !uploadingVideo && videoInputRef.current?.click()}
              disabled={uploadingVideo}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-70"
            >
              <Video className="w-3.5 h-3.5" />
              {uploadingVideo
                ? 'Uploading video…'
                : profile.introVideoUrl
                ? 'Replace intro video'
                : 'Add a 30-second intro video'}
            </button>
          </div>

          {/* Info Content - Stacked below avatar */}
          <div className="mt-4">
            {/* Name & Headline */}
            <div className="text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                {/* Prompt rather than a blank line: a new account has no name
                    on it yet, and the fix is one click away in Edit. */}
                <h1
                  className={`text-2xl font-bold tracking-tight ${
                    profile.name
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-400 dark:text-gray-500 italic'
                  }`}
                >
                  {profile.name || 'Add your name'}
                </h1>
                {identityStatus === 'APPROVED' ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium border border-green-200 dark:border-green-700"
                    title="Identity verified"
                  >
                    <BadgeCheck className="w-4 h-4" />
                    Verified
                  </span>
                ) : identityStatus === 'PENDING' ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium border border-amber-200 dark:border-amber-700"
                    title="Verification under review"
                  >
                    <Clock className="w-4 h-4" />
                    Verification pending
                  </span>
                ) : identityStatus === 'REJECTED' ? (
                  <button
                    onClick={() => setIsVerifyOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors border border-red-200 dark:border-red-700"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Verification failed — resubmit
                  </button>
                ) : (
                  <button
                    onClick={() => setIsVerifyOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors border border-green-200 dark:border-green-700"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Get Verified
                  </button>
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-300 mt-1 font-medium">
                {profile.headline}
              </p>
              {eligibility && (
                <div className="mt-2 flex justify-center sm:justify-start">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-semibold border border-red-200 dark:border-red-800">
                    <Flag className="w-3.5 h-3.5" />
                    {eligibility.badge}
                    {eligibility.hasExpiry && profile.workPermitExpiry
                      ? ` · until ${profile.workPermitExpiry}`
                      : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Location & Status */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                <MapPin className="w-4 h-4" />
                {profile.location}
              </span>
              {profile.openToWork && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                    <Briefcase className="w-4 h-4" />
                    Open to work
                  </span>
                </>
              )}
              {/* Connections are not tracked yet, so the stat hides rather
                  than reporting the "500+" this used to be seeded with. */}
              {profile.connections && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">•</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {profile.connections} connections
                  </span>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center sm:justify-start gap-2.5 mt-5">
              <button
                onClick={handleShare}
                aria-label="Share profile"
                className="group flex items-center h-10 rounded-full px-2.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300"
              >
                <Send className="w-5 h-5 shrink-0 transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 group-hover:max-w-[60px] group-hover:opacity-100 group-hover:ml-1.5 text-sm font-medium transition-all duration-300">
                  Share
                </span>
              </button>
              <button
                onClick={openEditModal}
                aria-label="Edit profile"
                className="group flex items-center h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-2.5 shadow-md hover:shadow-lg transition-all duration-300"
              >
                <Edit3 className="w-5 h-5 shrink-0 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 group-hover:max-w-[90px] group-hover:opacity-100 group-hover:ml-1.5 text-sm font-medium transition-all duration-300">
                  Edit profile
                </span>
              </button>
              {/* The overflow menu: the things you do to a profile rather than
                  to its content. The button was here already but opened
                  nothing. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="More profile actions"
                    className="h-10 w-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={handleSavePdf}
                    // An empty profile would export a page with a date on it.
                    disabled={!hasResumeContent(profile)}
                  >
                    <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                    Save to PDF
                  </DropdownMenuItem>
                  {/* The same address Share hands out, so the preview is
                      literally what a recruiter opens. */}
                  <DropdownMenuItem onClick={() => navigate(publicProfilePath)}>
                    <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" />
                    View as a recruiter
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/jobseeker/settings')}>
                    <Settings className="w-4 h-4 mr-2" aria-hidden="true" />
                    Profile settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Shown only once the server answers: a flash of zeroes reads as
                "nobody looked", which is a different claim from "not loaded". */}
            {stats.data && (
              <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6 sm:gap-8">
                  {/* The count opens the list. Who is in that list is each
                      viewer's own choice — see ProfileViewersDialog. */}
                  <button
                    type="button"
                    onClick={() => setViewersOpen(true)}
                    className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                      <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.data.views.toLocaleString()}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 ml-1">
                        {stats.data.views === 1 ? 'profile view' : 'profile views'}
                      </span>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 text-sm px-3 py-1.5">
                    <div className="p-1.5 bg-green-50 dark:bg-green-900/30 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" aria-hidden="true" />
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {stats.data.searchAppearances.toLocaleString()}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 ml-1">
                        {stats.data.searchAppearances === 1 ? 'search appearance' : 'search appearances'}
                      </span>
                    </div>
                  </div>
                </div>
                {/* The honest part: counting began when this shipped, so the
                    date says what the numbers actually cover. */}
                <p className="mt-2 px-3 text-xs text-gray-400 dark:text-gray-500">
                  Since{' '}
                  {new Date(stats.data.since).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  . A viewer counts once a day.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ProfileViewersDialog open={viewersOpen} onOpenChange={setViewersOpen} />

      {/* Video Modal */}
      <VideoModel
        isOpen={isVideoOpen}
        onClose={() => setIsVideoOpen(false)}
        videoUrl={profile.introVideoUrl || ''}
        title={`${profile.name}'s Video Introduction`}
      />

      {/* Edit Profile Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 py-2">
            {/* Left column — fields */}
            <div className="space-y-4">
            {/* Profile photo */}
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Profile Photo
              </Label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 shrink-0 rounded-full border border-gray-300 dark:border-gray-600 overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  {uploadingAvatar ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  ) : (
                    <ProfileAvatar
                      name={profile.name}
                      avatarUrl={avatarSrc}
                      className="w-full h-full"
                      textClassName="text-base"
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={uploadingAvatar}
                    onClick={() => dialogAvatarInputRef.current?.click()}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {profile.avatarUrl ? 'Change' : 'Upload'}
                  </Button>
                  {profile.avatarUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={uploadingAvatar}
                      onClick={removeAvatar}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <input
                ref={dialogAvatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                aria-label="Upload profile photo"
              />
            </div>

            <div>
              <Label htmlFor="edit-name" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Full Name
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="edit-headline" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Headline
                </Label>
                <button
                  type="button"
                  onClick={handleSuggestHeadlines}
                  disabled={loadingHeadlines}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 disabled:opacity-60"
                >
                  {loadingHeadlines ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {loadingHeadlines ? 'Thinking…' : 'Improve with AI'}
                </button>
              </div>
              <Input
                id="edit-headline"
                value={editHeadline}
                onChange={(e) => setEditHeadline(e.target.value.slice(0, 120))}
                placeholder="e.g. Senior Product Manager | AI & FinTech"
              />
              <p className={`text-xs mt-1 text-right ${editHeadline.length >= 120 ? 'text-red-500' : 'text-gray-400'}`}>
                {editHeadline.length} / 120
              </p>

              {headlineSuggestions.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Tap one to use it:</p>
                  {headlineSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setEditHeadline(s.slice(0, 120))}
                      className="w-full text-left text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors text-gray-700 dark:text-gray-300"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="edit-location" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Location
              </Label>
              <Input
                id="edit-location"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="e.g. Lagos, Nigeria"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Open to work</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Show recruiters you're actively looking</p>
              </div>
              <Switch checked={editOpenToWork} onCheckedChange={setEditOpenToWork} />
            </div>
            </div>

            {/* Right column — intro video */}
            <div className="flex flex-col">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Introduction Video
              </Label>
              {uploadingVideo ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 p-5 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-sm font-medium">Uploading…</span>
                </div>
              ) : profile.introVideoUrl ? (
                <div className="space-y-2 flex-1">
                  <video
                    src={profile.introVideoUrl}
                    controls
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-black"
                    style={{ maxHeight: '200px' }}
                  />
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Video className="w-3.5 h-3.5" /> Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => updateProfileInfo({ introVideoUrl: undefined })}
                      className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex-1 flex flex-col items-center justify-center gap-2 p-5 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors text-gray-400 dark:text-gray-500"
                >
                  <Video className="w-7 h-7" />
                  <span className="text-sm font-medium">Upload a video</span>
                  <span className="text-xs">MP4, MOV, WebM — max 50 MB</span>
                </button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="rounded-full bg-orange-500 hover:bg-orange-600 text-white" onClick={handleSaveProfile}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Identity Verification Dialog */}
      <Dialog open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
              Verify your identity
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Verified profiles earn recruiter trust and stand out in search. Upload a
              government-issued ID and our team will review it. Your document is stored
              privately and only visible to our review team.
            </p>

            {identityStatus === 'REJECTED' && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700 dark:text-red-400">
                  Your previous request was declined. You can submit a new one below.
                </p>
              </div>
            )}

            {/* ID document */}
            <div>
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Government-issued ID <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              {verifyFile ? (
                <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 truncate">
                    <FileText className="w-4 h-4 shrink-0 text-gray-400" />
                    <span className="truncate">{verifyFile.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setVerifyFile(null)}
                    className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 shrink-0"
                  >
                    <X className="w-3 h-3" /> Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => verifyFileRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-1.5 p-5 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-green-400 dark:hover:border-green-600 hover:bg-green-50/50 dark:hover:bg-green-900/10 transition-colors text-gray-400 dark:text-gray-500"
                >
                  <FileText className="w-6 h-6" />
                  <span className="text-sm font-medium">Upload ID document</span>
                  <span className="text-xs">PNG, JPG, WebP, or PDF — max 10 MB</span>
                </button>
              )}
              <input
                ref={verifyFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                onChange={handleVerifyFileSelect}
                className="hidden"
                aria-label="Upload ID document"
              />
            </div>

            <div>
              <Label htmlFor="verify-note" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                Note <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                id="verify-note"
                value={verifyNote}
                onChange={(e) => setVerifyNote(e.target.value.slice(0, 2000))}
                placeholder="Anything that helps us verify you faster…"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setIsVerifyOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="rounded-full bg-green-600 hover:bg-green-700 text-white"
              onClick={handleSubmitVerification}
              disabled={submittingVerification}
            >
              {submittingVerification && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default ProfileHero;
