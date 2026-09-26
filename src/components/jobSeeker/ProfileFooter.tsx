import { Link } from 'react-router-dom';
import { ChevronRight, Settings as SettingsIcon } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';

/**
 * The end of the profile: where to change any of it.
 *
 * This card used to hold its own "Profile settings" — three switches, of which
 * only "Open to work" did anything. "Public profile" read a hardcoded "On" and
 * "Salary details" a hardcoded "Off", regardless of what the account actually
 * had set, so the page confidently contradicted /jobseeker/settings. All three
 * now live in Settings › Privacy, which saves them; this points there and
 * reports the one state worth seeing from the profile itself.
 */
const ProfileFooter = () => {
  const { profile } = useProfile();

  return (
    <footer className="rounded-lg border border-border bg-card p-5">
      <Link
        to="/jobseeker/settings"
        className="group flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-foreground/20 hover:bg-muted/60"
      >
        <div className="flex min-w-0 items-center gap-3">
          <SettingsIcon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Profile settings</p>
            <p className="text-xs text-muted-foreground">
              Visibility, open to work, contact details and notifications
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {profile.openToWork ? 'Open to work' : 'Not open to work'}
          </span>
          <ChevronRight
            className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>
      </Link>

      {/* Real pages, not "#". There is no product name here on purpose — the
          app calls itself two different things in two other footers. */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
        <Link to="/privacy-policy" className="transition-colors hover:text-foreground">Privacy</Link>
        <span aria-hidden="true">·</span>
        <Link to="/terms-of-service" className="transition-colors hover:text-foreground">Terms</Link>
        <span aria-hidden="true">·</span>
        <Link to="/contact-us" className="transition-colors hover:text-foreground">Help</Link>
      </div>
    </footer>
  );
};

export default ProfileFooter;
