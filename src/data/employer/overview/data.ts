import { Bot, Building2, Megaphone } from "lucide-react";
import qaAi from "@/assets/qa-ai.jpg";
import qaProfile from "@/assets/qa-profile.jpg";
import qaSponsor from "@/assets/qa-sponsor.jpg";

/**
 * The three shortcuts on the dashboard. Presentation only — no figures.
 *
 * What used to live beside them, and why it is gone:
 *
 * - `employer = { companyName: "Acme Inc.", user: "John" }` was used as a
 *   *fallback* when a company had no branding, so a real employer who hadn't
 *   finished setup was greeted as "John" at "Acme Inc.". The dashboard now
 *   shows what it actually knows, or says nothing.
 * - `feed` and `nextActions` were fixtures for the activity feed and the
 *   next-best-action rail. Both were wired to real endpoints and the fixtures
 *   were left behind, unreferenced: six invented events naming people who do
 *   not exist ("Sarah Lin", "Marcus Chen") with invented numbers ("96% AI fit",
 *   "views up 34%", "8 candidates viewing your roles in the last 10 minutes"),
 *   and three recommendations claiming "sponsored jobs fill 2.4x faster".
 *
 * Keep this file free of numbers. Anything measured belongs on an endpoint.
 */
export const quickActions = [
  {
    icon: Bot,
    title: "Talent Scout",
    desc: "Search candidates, rank them against a role, and draft outreach.",
    cta: "Open Talent Scout",
    badge: "New",
    img: qaAi,
    to: "/employers/hiring",
  },
  {
    icon: Building2,
    title: "Enhance Company Profile",
    desc: "Boost trust with brand assets, culture, and employee stories.",
    cta: "Improve profile",
    img: qaProfile,
    to: "/employers/company",
  },
  {
    // "3x reach, faster fills" and a "Popular" badge were here. Nothing
    // measures either, and a reach multiplier is the kind of claim someone
    // spends money on.
    icon: Megaphone,
    title: "Sponsor a Job",
    desc: "Promote a role so it reaches more of the right candidates.",
    cta: "See plans",
    img: qaSponsor,
    to: "/employers/pricing",
  },
];
