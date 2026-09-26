export type AppStatus =
  | "applied"
  | "viewed"
  | "under_review"
  | "assessment"
  | "shortlisted"
  | "interview_scheduled"
  | "interview_completed"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn";

export const STATUS_META: Record<AppStatus, { label: string; tone: string }> = {
  applied: { label: "Applied", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  viewed: { label: "Viewed", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  under_review: { label: "Under Review", tone: "bg-blue-50 text-blue-700 border-blue-200" },
  assessment: { label: "Assessment", tone: "bg-violet-50 text-violet-700 border-violet-200" },
  shortlisted: { label: "Shortlisted", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  interview_scheduled: { label: "Interview Scheduled", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  interview_completed: { label: "Interview Completed", tone: "bg-orange-50 text-orange-700 border-orange-200" },
  offer: { label: "Offer Received", tone: "bg-orange-100 text-orange-700 border-orange-300" },
  hired: { label: "Hired", tone: "bg-orange-500 text-white border-orange-500" },
  rejected: { label: "Rejected", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  withdrawn: { label: "Withdrawn", tone: "bg-gray-100 text-gray-600 border-gray-200" },
};

export interface Application {
  id: string;
  job: string;
  company: string;
  companyLogo: string;
  location: string;
  remote: "Remote" | "Hybrid" | "On-site";
  appliedDate: string;
  status: AppStatus;
  lastActivity: string;
  salary: string;
  type: "Full-time" | "Contract" | "Part-time";
  /** Optional — real applications have no designated recruiter contact. */
  recruiter?: { name: string; title: string; avatar: string };
  timeline: { event: string; date: string; note?: string }[];
}

const today = new Date();
const d = (days: number) => {
  const x = new Date(today);
  x.setDate(x.getDate() - days);
  return x.toISOString().slice(0, 10);
};

export const APPLICATIONS: Application[] = [
  {
    id: "a1", job: "Senior Product Designer", company: "Linear", companyLogo: "L",
    location: "San Francisco, CA", remote: "Remote", appliedDate: d(2),
    status: "interview_scheduled", lastActivity: "2h ago", salary: "$160k–$200k", type: "Full-time",
    recruiter: { name: "Maya Lin", title: "Senior Recruiter", avatar: "ML" },
    timeline: [
      { event: "Application submitted", date: d(8) },
      { event: "Viewed by recruiter", date: d(7), note: "Profile reviewed" },
      { event: "Shortlisted", date: d(5) },
      { event: "Interview scheduled", date: d(2), note: "Video — Thu 3pm PT" },
    ],
  },
  {
    id: "a2", job: "Staff Frontend Engineer", company: "Vercel", companyLogo: "V",
    location: "New York, NY", remote: "Hybrid", appliedDate: d(5),
    status: "offer", lastActivity: "1d ago", salary: "$220k–$260k", type: "Full-time",
    recruiter: { name: "Theo Park", title: "Talent Partner", avatar: "TP" },
    timeline: [
      { event: "Application submitted", date: d(20) },
      { event: "Phone screen", date: d(17) },
      { event: "Technical interview", date: d(12) },
      { event: "Onsite (virtual)", date: d(6) },
      { event: "Offer sent", date: d(1), note: "Expires in 6 days" },
    ],
  },
  {
    id: "a3", job: "Engineering Manager", company: "Stripe", companyLogo: "S",
    location: "Remote", remote: "Remote", appliedDate: d(10),
    status: "under_review", lastActivity: "3d ago", salary: "$240k–$300k", type: "Full-time",
    recruiter: { name: "Aisha Khan", title: "EM Recruiter", avatar: "AK" },
    timeline: [
      { event: "Application submitted", date: d(10) },
      { event: "Viewed by recruiter", date: d(7) },
    ],
  },
  {
    id: "a4", job: "Product Manager, Growth", company: "Notion", companyLogo: "N",
    location: "San Francisco, CA", remote: "Hybrid", appliedDate: d(14),
    status: "assessment", lastActivity: "4h ago", salary: "$180k–$220k", type: "Full-time",
    recruiter: { name: "Jordan Reyes", title: "PM Recruiter", avatar: "JR" },
    timeline: [
      { event: "Application submitted", date: d(14) },
      { event: "Recruiter screen", date: d(10) },
      { event: "Assessment sent", date: d(3), note: "Due in 2 days" },
    ],
  },
  {
    id: "a5", job: "Senior Data Scientist", company: "Airbnb", companyLogo: "A",
    location: "Seattle, WA", remote: "On-site", appliedDate: d(22),
    status: "rejected", lastActivity: "5d ago", salary: "$190k–$240k", type: "Full-time",
    recruiter: { name: "Sam Wright", title: "Data Recruiter", avatar: "SW" },
    timeline: [
      { event: "Application submitted", date: d(22) },
      { event: "Phone screen", date: d(18) },
      { event: "Rejected", date: d(5), note: "Position closed" },
    ],
  },
  {
    id: "a6", job: "Design Lead", company: "Figma", companyLogo: "F",
    location: "Remote", remote: "Remote", appliedDate: d(3),
    status: "viewed", lastActivity: "1d ago", salary: "$210k–$250k", type: "Full-time",
    recruiter: { name: "Lena Ortiz", title: "Design Recruiter", avatar: "LO" },
    timeline: [
      { event: "Application submitted", date: d(3) },
      { event: "Viewed by recruiter", date: d(1) },
    ],
  },
  {
    id: "a7", job: "Full-Stack Engineer", company: "Ramp", companyLogo: "R",
    location: "New York, NY", remote: "Hybrid", appliedDate: d(1),
    status: "applied", lastActivity: "1d ago", salary: "$170k–$210k", type: "Full-time",
    recruiter: { name: "Chris Vega", title: "Tech Recruiter", avatar: "CV" },
    timeline: [{ event: "Application submitted", date: d(1) }],
  },
  {
    id: "a8", job: "Senior UX Researcher", company: "Datadog", companyLogo: "D",
    location: "Boston, MA", remote: "Hybrid", appliedDate: d(30),
    status: "hired", lastActivity: "10d ago", salary: "$165k–$195k", type: "Full-time",
    recruiter: { name: "Priya Shah", title: "UX Recruiter", avatar: "PS" },
    timeline: [
      { event: "Application submitted", date: d(60) },
      { event: "Offer accepted", date: d(10) },
    ],
  },
];

export const KPIS = [
  { id: "apps", label: "Applications Sent", value: 42, delta: "+12 this month", spark: [3, 5, 4, 7, 6, 9, 8] },
  { id: "active", label: "Active Applications", value: 18, delta: "Under review", spark: [10, 12, 14, 13, 15, 17, 18] },
  { id: "interviews", label: "Interviews Scheduled", value: 5, delta: "Next: Thu 3pm", spark: [1, 2, 2, 3, 4, 4, 5] },
  { id: "offers", label: "Offers Received", value: 2, delta: "1 expires soon", spark: [0, 0, 1, 1, 1, 2, 2] },
  { id: "rate", label: "Response Rate", value: "63%", delta: "+7% vs last mo", spark: [40, 45, 50, 55, 58, 60, 63] },
  { id: "views", label: "Profile Views", value: 214, delta: "+24 this week", spark: [120, 140, 155, 170, 185, 200, 214] },
];

export type InterviewStatus = "upcoming" | "completed" | "cancelled" | "rescheduled";
export type InterviewMedium = "Video" | "Phone" | "On-site";
export type InterviewRound = "HR Screen" | "Technical" | "Managerial" | "Final Round";

export interface Interview {
  id: string;
  job: string;
  company: string;
  // Optional where the server doesn't store the field yet (real interviews).
  round?: InterviewRound;
  type: InterviewMedium;
  /** ISO date (YYYY-MM-DD). "Today" is derived by comparing this to the current date. */
  date: string;
  time: string;
  tz?: string;
  duration?: string;
  status: InterviewStatus;
  meetingLink?: string;
  location?: string;
  interviewer?: { name: string; role: string };
  instructions?: string;
  /** Post-interview decision shared by the employer (no-ghosting). */
  outcome?: "advancing" | "rejected" | "hold" | "hired" | null;
  outcomeNote?: string | null;
  documents: string[];
  prep: string[];
  timeline: { event: string; date: string; done: boolean }[];
}

// d(negative) yields a future date (upcoming); d(positive) is in the past.
export const INTERVIEWS: Interview[] = [
  {
    id: "i1", job: "Senior Product Designer", company: "Linear", round: "Final Round", type: "Video",
    date: d(0), time: "3:00 PM", tz: "PT", duration: "45 min", status: "upcoming",
    meetingLink: "https://meet.google.com/abc-defg-hij",
    interviewer: { name: "Maya Lin", role: "Design Director" },
    instructions: "Join 5 minutes early. Be ready to walk through one case study and share your screen.",
    documents: ["Portfolio", "Updated résumé"],
    prep: ["Review company & role", "Prepare 3 questions", "Test camera & mic"],
    timeline: [
      { event: "Interview invitation received", date: d(6), done: true },
      { event: "Interview confirmed", date: d(5), done: true },
      { event: "Reminder sent", date: d(1), done: true },
      { event: "Interview completed", date: d(0), done: false },
      { event: "Feedback received", date: d(0), done: false },
    ],
  },
  {
    id: "i2", job: "Product Manager, Growth", company: "Notion", round: "Managerial", type: "Phone",
    date: d(-2), time: "10:00 AM", tz: "PT", duration: "30 min", status: "upcoming",
    meetingLink: "tel:+1-555-0142",
    interviewer: { name: "Jordan Reyes", role: "Hiring Manager" },
    instructions: "The recruiter will call you at the number on file. Have your résumé handy.",
    documents: ["Résumé"],
    prep: ["Prepare a 60-second intro", "Outline 2 product wins"],
    timeline: [
      { event: "Interview invitation received", date: d(4), done: true },
      { event: "Interview confirmed", date: d(3), done: true },
      { event: "Interview completed", date: d(-2), done: false },
    ],
  },
  {
    id: "i3", job: "Staff Frontend Engineer", company: "Vercel", round: "Technical", type: "On-site",
    date: d(-5), time: "1:00 PM", tz: "ET", duration: "2 hr", status: "upcoming",
    location: "Vercel HQ, 440 N Wolfe Rd, New York, NY",
    interviewer: { name: "Theo Park", role: "Engineering Manager" },
    instructions: "Check in at the front desk and ask for the Engineering team. Bring a photo ID.",
    documents: ["Photo ID", "Résumé"],
    prep: ["Review system design basics", "Revisit past projects", "Prepare scaling trade-offs"],
    timeline: [
      { event: "Interview invitation received", date: d(8), done: true },
      { event: "Interview confirmed", date: d(7), done: true },
      { event: "Interview completed", date: d(-5), done: false },
    ],
  },
  {
    id: "i4", job: "Engineering Manager", company: "Stripe", round: "HR Screen", type: "Video",
    date: d(5), time: "11:00 AM", tz: "PT", duration: "30 min", status: "completed",
    meetingLink: "https://meet.google.com/xyz-1234-klm",
    interviewer: { name: "Aisha Khan", role: "Senior Recruiter" },
    instructions: "Initial screen covering background and motivation.",
    documents: ["Résumé"],
    prep: [],
    timeline: [
      { event: "Interview invitation received", date: d(12), done: true },
      { event: "Interview confirmed", date: d(10), done: true },
      { event: "Interview completed", date: d(5), done: true },
      { event: "Feedback received", date: d(3), done: true },
      { event: "Final hiring decision", date: d(3), done: false },
    ],
  },
  {
    id: "i5", job: "Senior Data Scientist", company: "Airbnb", round: "Technical", type: "Video",
    date: d(-3), time: "2:30 PM", tz: "PT", duration: "1 hr", status: "rescheduled",
    meetingLink: "https://zoom.us/j/9988776655",
    interviewer: { name: "Sam Wright", role: "Data Science Lead" },
    instructions: "Rescheduled from last week. Coding + statistics round.",
    documents: ["Résumé"],
    prep: ["Brush up on A/B testing", "Review SQL window functions"],
    timeline: [
      { event: "Interview invitation received", date: d(9), done: true },
      { event: "Interview confirmed", date: d(8), done: true },
      { event: "Interview rescheduled", date: d(2), done: true },
      { event: "Interview completed", date: d(-3), done: false },
    ],
  },
  {
    id: "i6", job: "Product Designer", company: "Figma", round: "HR Screen", type: "Video",
    date: d(1), time: "9:00 AM", tz: "PT", duration: "30 min", status: "cancelled",
    meetingLink: "https://meet.google.com/can-cell-ed",
    interviewer: { name: "Lena Ortiz", role: "Design Recruiter" },
    instructions: "This interview was cancelled by the employer.",
    documents: [],
    prep: [],
    timeline: [
      { event: "Interview invitation received", date: d(5), done: true },
      { event: "Interview cancelled", date: d(2), done: true },
    ],
  },
];

export interface SavedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  type: "Full-time" | "Contract" | "Part-time";
  /** Match score (0–100). Optional — not computed server-side yet. */
  match?: number;
  posted: string;
  /** Optional derived badge (e.g. "Closing Soon", "Recently Posted"). */
  badge?: string;
  /** Short "About the Role" summary shown in the details drawer. */
  description: string;
  /** Key responsibilities shown in the details drawer. */
  responsibilities: string[];
  /** Perks/benefits shown in the details drawer. */
  benefits: string[];
  /** Skills/tags shown in the details drawer. */
  skills: string[];
  /** "About Company" details shown in the drawer (optional). */
  companyAbout?: string;
  companyIndustry?: string;
  companySize?: string;
}

export const SAVED_JOBS: SavedJob[] = [
  {
    id: "s1", title: "Head of Design", company: "Loom", location: "Remote", salary: "$230k–$280k",
    type: "Full-time", match: 94, posted: "2d ago", badge: "Recently Posted",
    description:
      "Lead Loom's design org and set the vision for how millions of people communicate through video. You'll partner closely with product and engineering leadership to shape strategy and raise the craft bar across the company.",
    responsibilities: [
      "Define and drive the end-to-end product design vision",
      "Hire, mentor, and grow a team of senior designers",
      "Partner with PM and Eng leaders on roadmap and strategy",
      "Establish design systems and quality standards",
    ],
    benefits: [
      "Meaningful equity package",
      "Comprehensive health, dental & vision",
      "Fully remote with home-office stipend",
      "Annual learning & development budget",
    ],
    skills: ["Design Leadership", "Design Systems", "Figma", "Product Strategy", "Prototyping"],
    companyAbout:
      "Loom is an async video messaging platform that helps teams communicate clearly without more meetings. Millions of people across 350k+ companies use Loom to record, share, and collaborate over video.",
    companyIndustry: "Video Communication",
    companySize: "201–500 employees",
  },
  {
    id: "s2", title: "Senior PM, Platform", company: "Anthropic", location: "San Francisco", salary: "$220k–$270k",
    type: "Full-time", match: 88, posted: "5d ago", badge: "High Competition",
    description:
      "Own the roadmap for the platform that powers Anthropic's developer products. You'll work across research, engineering, and go-to-market to ship reliable, scalable APIs that customers build their businesses on.",
    responsibilities: [
      "Define platform strategy and quarterly roadmap",
      "Translate customer and developer needs into specs",
      "Coordinate cross-functional launches end to end",
      "Track adoption metrics and iterate on feedback",
    ],
    benefits: [
      "Equity with RSU refreshers",
      "Premium health coverage",
      "401(k) with company match",
      "Flexible PTO policy",
    ],
    skills: ["Roadmapping", "APIs", "Analytics", "Stakeholder Management", "SQL"],
    companyAbout:
      "Anthropic is an AI safety company building reliable, interpretable, and steerable AI systems. Its research and products, including Claude, focus on making AI helpful and safe at scale.",
    companyIndustry: "AI Safety & Research",
    companySize: "501–1,000 employees",
  },
  {
    id: "s3", title: "Principal Engineer", company: "Retool", location: "Remote", salary: "$260k–$320k",
    type: "Full-time", match: 91, posted: "7d ago", badge: "Closing Soon",
    description:
      "Set the technical direction for Retool's core platform and tackle our hardest scaling and architecture problems. As a principal, you'll lead by influence across teams and mentor engineers while still shipping critical code.",
    responsibilities: [
      "Own architecture for high-scale, high-reliability systems",
      "Lead complex technical initiatives across teams",
      "Mentor senior and staff engineers",
      "Drive engineering best practices and standards",
    ],
    benefits: [
      "Significant early-stage equity",
      "Health, dental & vision coverage",
      "Remote-first with flexible hours",
      "Home-office & wellness budget",
    ],
    skills: ["Distributed Systems", "TypeScript", "System Architecture", "Mentorship", "Scalability"],
    companyAbout:
      "Retool is a platform for building internal tools fast. Engineering teams use Retool to assemble apps from prebuilt components and connect to virtually any database or API.",
    companyIndustry: "Developer Tools",
    companySize: "201–500 employees",
  },
];

export interface RelatedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  type: "Full-time" | "Contract" | "Part-time";
  match: number;
}

export const RELATED_JOBS: RelatedJob[] = [
  { id: "r1", title: "Staff Product Designer", company: "Figma", location: "Remote", type: "Full-time", match: 92 },
  { id: "r2", title: "Design Manager", company: "Webflow", location: "San Francisco", type: "Full-time", match: 87 },
  { id: "r3", title: "Senior UX Engineer", company: "Vercel", location: "Remote", type: "Full-time", match: 84 },
  { id: "r4", title: "Head of Product", company: "Linear", location: "Remote", type: "Full-time", match: 90 },
  { id: "r5", title: "Principal Designer", company: "Stripe", location: "New York", type: "Full-time", match: 88 },
];

/* --------------------------------- Alerts -------------------------------- */

export type AlertFrequency = "Instant" | "Daily" | "Weekly";
export type AlertEmploymentType = "Full-time" | "Part-time" | "Contract" | "Internship";
export type AlertRemote = "Any" | "Remote" | "Hybrid" | "On-site";
export type AlertExperience = "Entry" | "Mid" | "Senior" | "Lead";

export interface AlertMatch {
  id: string;
  title: string;
  company: string;
  companyLogo: string;
  location: string;
  salary: string;
  posted: string;
}

export interface AlertChannels {
  email: boolean;
  push: boolean;
  inApp: boolean;
}

export interface JobAlert {
  id: string;
  title: string;
  keywords: string[];
  location: string;
  remote?: AlertRemote;
  type: AlertEmploymentType;
  experience: AlertExperience;
  salary: string;
  frequency: AlertFrequency;
  active: boolean;
  // Not backed by the server yet (no per-alert matching endpoint / channel store).
  newMatches?: number;
  channels?: AlertChannels;
  matches?: AlertMatch[];
}

export const ALERTS: JobAlert[] = [
  {
    id: "al1", title: "Senior Product Designer", keywords: ["Design Systems", "Figma"], location: "Remote",
    remote: "Remote", type: "Full-time", experience: "Senior", salary: "$160k–$210k", frequency: "Daily",
    active: true, newMatches: 8,
    channels: { email: true, push: true, inApp: true },
    matches: [
      { id: "m1", title: "Senior Product Designer", company: "Loom", companyLogo: "L", location: "Remote", salary: "$170k–$200k", posted: "2h ago" },
      { id: "m2", title: "Lead Product Designer", company: "Webflow", companyLogo: "W", location: "Remote", salary: "$180k–$220k", posted: "5h ago" },
      { id: "m3", title: "Senior UX Designer", company: "Notion", companyLogo: "N", location: "San Francisco", salary: "$165k–$200k", posted: "1d ago" },
    ],
  },
  {
    id: "al2", title: "Engineering Manager", keywords: ["Leadership", "Frontend"], location: "San Francisco",
    remote: "Hybrid", type: "Full-time", experience: "Lead", salary: "$220k–$280k", frequency: "Instant",
    active: true, newMatches: 3,
    channels: { email: true, push: false, inApp: true },
    matches: [
      { id: "m4", title: "Engineering Manager, Web", company: "Stripe", companyLogo: "S", location: "San Francisco", salary: "$240k–$300k", posted: "1h ago" },
      { id: "m5", title: "Frontend Engineering Lead", company: "Ramp", companyLogo: "R", location: "New York", salary: "$230k–$280k", posted: "3h ago" },
    ],
  },
  {
    id: "al3", title: "Product Manager, Growth", keywords: ["Growth", "B2B SaaS"], location: "New York",
    remote: "Any", type: "Full-time", experience: "Mid", salary: "$150k–$190k", frequency: "Weekly",
    active: false, newMatches: 0,
    channels: { email: true, push: false, inApp: false },
    matches: [
      { id: "m6", title: "Growth Product Manager", company: "Vercel", companyLogo: "V", location: "Remote", salary: "$160k–$200k", posted: "2d ago" },
    ],
  },
];