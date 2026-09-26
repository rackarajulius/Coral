import { useEffect, useState } from 'react';
import { Mail, Globe, Linkedin, Github, Twitter, Link2, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useProfile, ContactLinks } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';

type SocialField = 'website' | 'linkedin' | 'github' | 'twitter';

const SOCIAL_FIELDS: { key: SocialField; label: string; placeholder: string; icon: typeof Globe }[] = [
  { key: 'website', label: 'Website', placeholder: 'https://yoursite.com', icon: Globe },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/you', icon: Linkedin },
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/you', icon: Github },
  { key: 'twitter', label: 'X / Twitter', placeholder: 'https://x.com/you', icon: Twitter },
];

const ContactLinksSection = () => {
  const { profile, updateContactLinks } = useProfile();
  const { user } = useAuth();

  // Local working copy of the social URLs; commit to context on blur.
  const [draft, setDraft] = useState<ContactLinks>(profile.contactLinks);
  // Which social links are visible (those with a value, plus any just added).
  const [shown, setShown] = useState<SocialField[]>(
    SOCIAL_FIELDS.filter((f) => (profile.contactLinks[f.key] || '').trim()).map((f) => f.key),
  );

  // Email comes from the account — auto-fill it once if it isn't set yet.
  const loginEmail = user?.email || '';
  useEffect(() => {
    if (loginEmail && !(profile.contactLinks.email || '').trim()) {
      updateContactLinks({ email: loginEmail });
      setDraft((d) => ({ ...d, email: loginEmail }));
    }
  }, [loginEmail, profile.contactLinks.email, updateContactLinks]);

  const emailToShow = (profile.contactLinks.email || loginEmail || '').trim();

  const commit = (key: SocialField) => {
    const value = (draft[key] || '').trim();
    if (value !== (profile.contactLinks[key] || '')) {
      updateContactLinks({ [key]: value });
    }
  };

  const addField = (key: SocialField) => {
    setShown((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const removeField = (key: SocialField) => {
    setShown((prev) => prev.filter((k) => k !== key));
    setDraft((d) => ({ ...d, [key]: '' }));
    if ((profile.contactLinks[key] || '').trim()) {
      updateContactLinks({ [key]: '' });
    }
  };

  const available = SOCIAL_FIELDS.filter((f) => !shown.includes(f.key));

  return (
    <section
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-md transition-shadow duration-300"
      role="region"
      aria-label="Contact and links section"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <Link2 className="w-5 h-5 text-gray-600 dark:text-gray-400" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Contact &amp; links</h2>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        How recruiters can reach you. Shown on your public profile.
      </p>

      {/* Email — from the signed-in account */}
      <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/60 dark:bg-gray-700/30">
        <Mail className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {emailToShow || 'No email on file'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Email · from your account</p>
        </div>
      </div>

      {/* Added social links */}
      {shown.length > 0 && (
        <div className="mt-3 space-y-2">
          {shown.map((key) => {
            const field = SOCIAL_FIELDS.find((f) => f.key === key)!;
            const Icon = field.icon;
            return (
              <div key={key} className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
                <Input
                  value={draft[key] || ''}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  onBlur={() => commit(key)}
                  placeholder={field.placeholder}
                  aria-label={field.label}
                  autoFocus={!(profile.contactLinks[key] || '').trim()}
                />
                <button
                  type="button"
                  onClick={() => removeField(key)}
                  aria-label={`Remove ${field.label}`}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add link */}
      {available.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="mt-3">
              <Plus className="w-4 h-4 mr-1.5" />
              Add link
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {available.map((field) => {
              const Icon = field.icon;
              return (
                <DropdownMenuItem key={field.key} onClick={() => addField(field.key)}>
                  <Icon className="w-4 h-4 mr-2" />
                  {field.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </section>
  );
};

export default ContactLinksSection;
