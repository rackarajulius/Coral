import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { uploadAvatar, deleteAvatar } from '@/lib/api/jobSeekerProfile';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Single source of truth for profile-photo changes. Both the profile hero and
 * the sidebar route through this so validation, the backend upload, and the
 * resulting profile update stay consistent. The avatar is persisted server-side
 * (Supabase Storage) and only the resulting URL is kept in profile state — we
 * never stash the raw image bytes (base64) in localStorage.
 */
export function useAvatarUpload() {
  const { updateProfileInfo } = useProfile();
  // The profile photo is also the account photo (the header, posts, chat), so
  // the signed-in user is re-read after every change.
  const { refreshUser } = useAuth();
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error('Photo must be under 5MB');
      return;
    }

    setUploading(true);
    try {
      const url = await uploadAvatar(file);
      updateProfileInfo({ avatarUrl: url });
      void refreshUser().catch(() => undefined);
      toast.success('Profile photo updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    setUploading(true);
    try {
      await deleteAvatar();
      updateProfileInfo({ avatarUrl: undefined });
      void refreshUser().catch(() => undefined);
      toast.success('Profile photo removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove photo');
    } finally {
      setUploading(false);
    }
  };

  return { uploading, upload, remove };
}
