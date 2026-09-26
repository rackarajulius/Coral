export interface SeoSettings {
  siteTitle: { EN: string; FR: string };
  metaDescription: { EN: string; FR: string };
  canonicalUrl: string;
  allowIndexing: boolean;
  ogTitle: string;
  ogDescription: string;
  twitterCardType: "summary" | "summary_large_image";
  socialImage: string | null;
}

export interface BrandingSettings {
  logo: string | null;
  favicon: string | null;
  darkModeLogo: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
}

export interface SocialSharingSettings {
  shareTitle: string;
  shareDescription: string;
  socialImage: string | null;
}

export interface Banner {
  id: string;
  message: string;
  type: "info" | "warning" | "promotion";
  startDate: string;
  endDate: string;
  status: "active" | "scheduled" | "expired" | "draft";
  enabled: boolean;
  targetPages: string[];
}

export const defaultSeoSettings: SeoSettings = {
  siteTitle: {
    EN: "Global Jobs — Find Work Anywhere",
    FR: "Global Jobs — Trouvez du travail partout",
  },
  metaDescription: {
    EN: "Browse thousands of remote and local jobs worldwide.",
    FR: "Parcourez des milliers d'offres d'emploi à distance et locales dans le monde entier.",
  },
  canonicalUrl: "https://www.globaljobs.io",
  allowIndexing: true,
  ogTitle: "Global Jobs — Find Work Anywhere",
  ogDescription: "Browse thousands of remote and local jobs worldwide.",
  twitterCardType: "summary_large_image",
  socialImage: null,
};

export const defaultBrandingSettings: BrandingSettings = {
  logo: null,
  favicon: null,
  darkModeLogo: null,
  primaryColor: "#2563EB",
  secondaryColor: "#1E293B",
  fontFamily: "Inter",
};

export const defaultSocialSettings: SocialSharingSettings = {
  shareTitle: "Global Jobs — Find Work Anywhere",
  shareDescription: "Browse thousands of remote and local jobs worldwide.",
  socialImage: null,
};

export const mockBanners: Banner[] = [
  {
    id: "1",
    message: "New feature: AI job matching now live",
    type: "info",
    startDate: "2024-03-01",
    endDate: "2024-04-01",
    status: "active",
    enabled: true,
    targetPages: ["homepage", "jobs"],
  },
  {
    id: "2",
    message: "Scheduled maintenance on March 15th",
    type: "warning",
    startDate: "2024-03-14",
    endDate: "2024-03-16",
    status: "scheduled",
    enabled: true,
    targetPages: ["all"],
  },
  {
    id: "3",
    message: "Spring hiring event — 20% off premium listings",
    type: "promotion",
    startDate: "2024-02-01",
    endDate: "2024-02-28",
    status: "expired",
    enabled: false,
    targetPages: ["employers"],
  },
];

export const systemFonts = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Nunito",
  "Source Sans Pro",
  "System Default",
];
