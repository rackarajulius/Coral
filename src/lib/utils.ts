import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Job icons can be either a static filename in /public/icons (mock data)
// or an absolute URL / data URI returned from the backend (uploaded logos, avatars).
export function resolveJobIcon(icon: string) {
  if (!icon) return icon;
  return /^(https?:|data:|\/)/.test(icon) ? icon : `/icons/${icon}`;
}
