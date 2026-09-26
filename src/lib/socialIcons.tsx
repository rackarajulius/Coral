import type { ComponentType } from "react";
import { Facebook, Github, Globe, Instagram, Link2, Linkedin, Youtube } from "lucide-react";

type SocialIcon = ComponentType<{ className?: string }>;

const XIcon: SocialIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const SOCIAL_ICON_MAP: Record<string, SocialIcon> = {
  linkedin: Linkedin,
  twitter: XIcon,
  x: XIcon,
  instagram: Instagram,
  youtube: Youtube,
  github: Github,
  facebook: Facebook,
  website: Globe,
};

/** Maps a free-form social platform label to an icon, falling back to a generic link icon. */
export function getSocialIcon(label: string): SocialIcon {
  const key = label.trim().toLowerCase();
  return SOCIAL_ICON_MAP[key] ?? (Link2 as SocialIcon);
}
