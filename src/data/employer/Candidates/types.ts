/**
 * The shared ladder's labels — see @/data/employer/pipelineLadder.
 *
 * "Sourced" and "Contacted" are new here: this board now shows people the
 * company went out and found as well as people who applied, and those two
 * rungs happen before any application exists.
 */
export type Stage =
  | "Sourced"
  | "Contacted"
  | "Applied"
  | "Screening"
  | "Interview"
  | "Offer"
  | "Hired"
  | "Rejected"
  | "Withdrawn";

/**
 * Stages that an interview being booked moves someone out of.
 *
 * Includes the two pre-application rungs: booking an interview with someone
 * you have only just found plainly moves them to Interview, and leaving them
 * at "Sourced" made the board disagree with the calendar.
 */
export const STAGES_BEFORE_INTERVIEW: Stage[] = [
  "Sourced",
  "Contacted",
  "Applied",
  "Screening",
];

/** The board's columns. Exits are not columns; people are filtered to them. */
export const STAGES: Stage[] = [
  "Sourced",
  "Contacted",
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Hired",
];

export interface TimelineEvent {
  id: string;
  type: "applied" | "stage" | "message" | "note" | "interview";
  text: string;
  at: string;
}

export interface Candidate {
  id: string;
  /**
   * How this person got here.
   *
   * `applied` rows are an application and carry contact details, because
   * applying shared them. `sourced` rows are someone the company found: they
   * have shared nothing, so their email and phone are withheld and outreach
   * goes through the platform.
   */
  source?: "applied" | "sourced";
  /** Applicant's userId — present for real applicants; powers "View full profile". */
  applicantId?: string;
  /**
   * The job applied to. Absent for AI-sourced candidates, who never applied to
   * anything — those can't join a job's screening round.
   */
  jobId?: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  currentRole: string;
  currentCompany: string;
  role: string; // applied for
  location: string;
  stage: Stage;
  /** Skill-overlap vs the job's listed skills. Null when the job lists none. */
  matchScore: number | null;
  appliedDate: string; // ISO
  status: "Active" | "On hold" | "Withdrawn";
  tags: string[];
  /** `match` present only when a real comparison exists (100 = matches the job). */
  skills: { name: string; match?: number }[];
  strengths: string[];
  concerns: string[];
  summary: string;
  experience: { title: string; company: string; period: string }[];
  education: { school: string; degree: string; year: string }[];
  timeline: TimelineEvent[];
  resumeUrl?: string;
}

export const MOCK_CANDIDATES: Candidate[] = [
  {
    id: "c1",
    name: "Sarah Chen",
    initials: "SC",
    email: "sarah.chen@gmail.com",
    phone: "+1 (415) 555-0142",
    currentRole: "Senior Frontend Engineer",
    currentCompany: "Linear",
    role: "Senior Frontend Engineer",
    location: "Berlin, DE",
    stage: "Interview",
    matchScore: 96,
    appliedDate: "2026-05-22",
    status: "Active",
    tags: ["Top Talent", "Referral"],
    skills: [
      { name: "React", match: 98 },
      { name: "TypeScript", match: 95 },
      { name: "Design Systems", match: 92 },
      { name: "Accessibility", match: 88 },
    ],
    strengths: [
      "Deep expertise in React performance and architecture",
      "Led migration of a 200k LOC codebase to TypeScript",
      "Strong design sensibilities and product thinking",
    ],
    concerns: [
      "Limited backend exposure beyond BFF patterns",
      "Has not led teams larger than 4 engineers",
    ],
    summary:
      "Sarah is a strong fit because her work at Linear maps almost 1:1 to the role's frontend leadership scope, and her open-source contributions show ownership beyond shipping features.",
    experience: [
      { title: "Senior Engineer", company: "Linear", period: "2022 — Present" },
      { title: "Engineer", company: "Stripe", period: "2019 — 2022" },
      { title: "Engineer", company: "Shopify", period: "2017 — 2019" },
    ],
    education: [{ school: "TU Berlin", degree: "B.Sc. Computer Science", year: "2017" }],
    timeline: [
      { id: "t1", type: "applied", text: "Applied via referral", at: "2026-05-22" },
      { id: "t2", type: "stage", text: "Moved to Screening", at: "2026-05-24" },
      { id: "t3", type: "message", text: "Recruiter sent intro message", at: "2026-05-25" },
      { id: "t4", type: "stage", text: "Moved to Interview", at: "2026-05-28" },
      { id: "t5", type: "note", text: "Strong systems thinking — Maya", at: "2026-05-29" },
    ],
    resumeUrl: "https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF1.pdf",
  },
  {
    id: "c2",
    name: "Marcus Johnson",
    initials: "MJ",
    email: "marcus.j@hey.com",
    phone: "+1 (212) 555-0188",
    currentRole: "Product Designer",
    currentCompany: "Notion",
    role: "Senior Product Designer",
    location: "New York, US",
    stage: "Screening",
    matchScore: 91,
    appliedDate: "2026-05-26",
    status: "Active",
    tags: ["Portfolio standout"],
    skills: [
      { name: "Figma", match: 99 },
      { name: "Design Systems", match: 94 },
      { name: "Prototyping", match: 90 },
      { name: "User Research", match: 78 },
    ],
    strengths: ["Exceptional craft", "Strong systems thinking", "Excellent written communication"],
    concerns: ["Has only worked at large companies", "Less hands-on with research"],
    summary: "Marcus brings polish and a design-systems backbone that complements our growing product team.",
    experience: [
      { title: "Product Designer", company: "Notion", period: "2021 — Present" },
      { title: "Designer", company: "Airbnb", period: "2018 — 2021" },
    ],
    education: [{ school: "RISD", degree: "BFA Graphic Design", year: "2018" }],
    timeline: [
      { id: "t1", type: "applied", text: "Applied via careers page", at: "2026-05-26" },
      { id: "t2", type: "stage", text: "Moved to Screening", at: "2026-05-27" },
    ],
  },
  {
    id: "c3",
    name: "Emily Rodriguez",
    initials: "ER",
    email: "emily.r@proton.me",
    phone: "+1 (650) 555-0117",
    currentRole: "Senior Data Scientist",
    currentCompany: "Anthropic",
    role: "Staff Data Scientist",
    location: "Remote",
    stage: "Offer",
    matchScore: 94,
    appliedDate: "2026-05-12",
    status: "Active",
    tags: ["Top Talent"],
    skills: [
      { name: "Python", match: 98 },
      { name: "ML Ops", match: 91 },
      { name: "Causal Inference", match: 87 },
      { name: "SQL", match: 95 },
    ],
    strengths: ["Published research", "Production ML experience", "Strong stakeholder communication"],
    concerns: ["Compensation expectations at top of band"],
    summary: "Emily is a rare blend of research depth and shipping discipline.",
    experience: [
      { title: "Senior DS", company: "Anthropic", period: "2023 — Present" },
      { title: "DS", company: "Meta", period: "2020 — 2023" },
    ],
    education: [{ school: "Stanford", degree: "M.S. Statistics", year: "2020" }],
    timeline: [
      { id: "t1", type: "applied", text: "Sourced by recruiter", at: "2026-05-12" },
      { id: "t2", type: "stage", text: "Moved to Interview", at: "2026-05-18" },
      { id: "t3", type: "stage", text: "Moved to Offer", at: "2026-05-30" },
    ],
    resumeUrl: "https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF1.pdf",
  },
  {
    id: "c4",
    name: "Diego Alvarez",
    initials: "DA",
    email: "diego@fastmail.com",
    phone: "+34 600 555 044",
    currentRole: "Backend Engineer",
    currentCompany: "GitHub",
    role: "Senior Backend Engineer",
    location: "Madrid, ES",
    stage: "Screening",
    matchScore: 82,
    appliedDate: "2026-05-28",
    status: "Active",
    tags: [],
    skills: [
      { name: "Go", match: 92 },
      { name: "Postgres", match: 88 },
      { name: "Kubernetes", match: 76 },
      { name: "gRPC", match: 80 },
    ],
    strengths: ["Distributed systems", "Reliability mindset"],
    concerns: ["Limited product collaboration in past roles"],
    summary: "Diego brings strong distributed systems chops to our platform team.",
    experience: [{ title: "Engineer", company: "GitHub", period: "2021 — Present" }],
    education: [{ school: "UPM Madrid", degree: "M.Sc. CS", year: "2021" }],
    timeline: [{ id: "t1", type: "applied", text: "Applied", at: "2026-05-28" }],
  },
  {
    id: "c5",
    name: "Yuki Tanaka",
    initials: "YT",
    email: "yuki.t@me.com",
    phone: "+81 90 5555 0199",
    currentRole: "Product Designer",
    currentCompany: "Mercari",
    role: "Senior Product Designer",
    location: "Tokyo, JP",
    stage: "Interview",
    matchScore: 88,
    appliedDate: "2026-05-20",
    status: "Active",
    tags: ["International"],
    skills: [
      { name: "Figma", match: 95 },
      { name: "Motion", match: 89 },
      { name: "iOS Design", match: 84 },
    ],
    strengths: ["Motion and interaction craft", "Cross-cultural product sense"],
    concerns: ["Timezone overlap"],
    summary: "Yuki's motion work would be a step-change for the brand surface.",
    experience: [{ title: "Designer", company: "Mercari", period: "2020 — Present" }],
    education: [{ school: "Tama Art University", degree: "BA Design", year: "2019" }],
    timeline: [
      { id: "t1", type: "applied", text: "Applied", at: "2026-05-20" },
      { id: "t2", type: "stage", text: "Moved to Interview", at: "2026-05-26" },
    ],
    resumeUrl: "https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF1.pdf",
  },
  {
    id: "c6",
    name: "Aisha Khan",
    initials: "AK",
    email: "aisha.k@gmail.com",
    phone: "+971 50 555 0166",
    currentRole: "Data Engineer",
    currentCompany: "Careem",
    role: "Senior Data Engineer",
    location: "Dubai, AE",
    stage: "Applied",
    matchScore: 79,
    appliedDate: "2026-05-30",
    status: "Active",
    tags: [],
    skills: [
      { name: "Spark", match: 90 },
      { name: "Airflow", match: 85 },
      { name: "dbt", match: 80 },
    ],
    strengths: ["Pipeline reliability", "Cost optimization"],
    concerns: ["Less streaming experience"],
    summary: "Solid data platform background with a focus on reliability and cost.",
    experience: [{ title: "DE", company: "Careem", period: "2019 — Present" }],
    education: [{ school: "AUS", degree: "B.Sc. CS", year: "2019" }],
    timeline: [{ id: "t1", type: "applied", text: "Applied", at: "2026-05-30" }],
  },
  {
    id: "c7",
    name: "Tom Becker",
    initials: "TB",
    email: "tom@becker.io",
    phone: "+1 (917) 555-0102",
    currentRole: "Marketing Lead",
    currentCompany: "Webflow",
    role: "Head of Marketing",
    location: "New York, US",
    stage: "Applied",
    matchScore: 72,
    appliedDate: "2026-05-31",
    status: "Active",
    tags: [],
    skills: [
      { name: "Content", match: 88 },
      { name: "SEO", match: 80 },
      { name: "Brand", match: 75 },
    ],
    strengths: ["Storytelling", "Cross-functional leadership"],
    concerns: ["Limited B2B SaaS experience"],
    summary: "Strong brand and content background, light on B2B funnels.",
    experience: [{ title: "Marketing Lead", company: "Webflow", period: "2022 — Present" }],
    education: [{ school: "NYU", degree: "BA Communications", year: "2017" }],
    timeline: [{ id: "t1", type: "applied", text: "Applied", at: "2026-05-31" }],
  },
  {
    id: "c8",
    name: "Sofia Martins",
    initials: "SM",
    email: "sofia.m@gmail.com",
    phone: "+351 91 555 0123",
    currentRole: "Engineering Manager",
    currentCompany: "Vercel",
    role: "Engineering Manager",
    location: "Lisbon, PT",
    stage: "Hired",
    matchScore: 97,
    appliedDate: "2026-04-10",
    status: "Active",
    tags: ["Top Talent", "Leadership"],
    skills: [
      { name: "Leadership", match: 96 },
      { name: "Hiring", match: 92 },
      { name: "Architecture", match: 89 },
    ],
    strengths: ["Calm under pressure", "Track record of hiring senior talent"],
    concerns: [],
    summary: "Sofia is exactly the kind of EM we want shaping the next phase.",
    experience: [{ title: "EM", company: "Vercel", period: "2022 — Present" }],
    education: [{ school: "IST Lisbon", degree: "M.Sc. CS", year: "2014" }],
    timeline: [
      { id: "t1", type: "applied", text: "Sourced", at: "2026-04-10" },
      { id: "t2", type: "stage", text: "Moved to Offer", at: "2026-05-02" },
      { id: "t3", type: "stage", text: "Hired", at: "2026-05-20" },
    ],
  },
  {
    id: "c9",
    name: "Lina Rossi",
    initials: "LR",
    email: "lina.rossi@outlook.com",
    phone: "+39 333 555 0144",
    currentRole: "CS Manager",
    currentCompany: "Intercom",
    role: "Head of CS",
    location: "Milan, IT",
    stage: "Screening",
    matchScore: 84,
    appliedDate: "2026-05-27",
    status: "Active",
    tags: [],
    skills: [
      { name: "CS Ops", match: 90 },
      { name: "Renewals", match: 86 },
    ],
    strengths: ["Net retention track record"],
    concerns: ["Smaller team management"],
    summary: "Lina's renewals track record is exceptional.",
    experience: [{ title: "CS Manager", company: "Intercom", period: "2020 — Present" }],
    education: [{ school: "Bocconi", degree: "MBA", year: "2020" }],
    timeline: [{ id: "t1", type: "applied", text: "Applied", at: "2026-05-27" }],
  },
];
