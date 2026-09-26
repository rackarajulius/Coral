export type Trend = number[];

export const kpiCards = [
  { id: "brand", label: "Employer Brand Score", value: "82", delta: 4.2, suffix: "/100", trend: [70, 72, 74, 73, 76, 80, 82], benchmark: "Industry avg 71", definition: "Composite score across visibility, engagement, and reputation." },
  { id: "views", label: "Profile Views", value: "48,210", delta: 32.1, trend: [120, 140, 160, 180, 200, 230, 260], benchmark: "+12k vs last month", definition: "Total visits to your employer profile." },
  { id: "followers", label: "Followers", value: "12,894", delta: 6.4, trend: [40, 42, 45, 48, 52, 56, 60], benchmark: "+782 new", definition: "Total followers across your branded pages." },
  { id: "apps", label: "Applications", value: "3,427", delta: 18.9, trend: [80, 90, 110, 115, 130, 150, 170], benchmark: "Conversion 4.2%", definition: "Total submitted applications in selected range." },
  { id: "interviews", label: "Interviews", value: "612", delta: 9.7, trend: [20, 22, 25, 28, 30, 33, 36], benchmark: "Conv 17.8%", definition: "Candidates advanced to interview stage." },
  { id: "hires", label: "Hires", value: "84", delta: 14.3, trend: [5, 6, 7, 8, 9, 11, 12], benchmark: "Velocity +8%", definition: "Total hires in the selected period." },
  { id: "tth", label: "Time To Hire", value: "21d", delta: -8.5, trend: [28, 27, 26, 25, 24, 22, 21], benchmark: "Goal 18d", definition: "Average days from application to offer accepted." },
  { id: "oar", label: "Offer Acceptance", value: "78%", delta: 3.1, trend: [70, 72, 74, 75, 76, 77, 78], benchmark: "Industry 71%", definition: "Percent of offers accepted by candidates." },
] as const;

export const insights = [
  { id: 1, type: "opportunity", severity: "high", confidence: 92, impact: "High", title: "Remote roles convert 2.4× better", body: "Convert hybrid roles to remote where possible to lift application volume.", action: "Review job mix" },
  { id: 2, type: "risk", severity: "medium", confidence: 87, impact: "Medium", title: "Application completion dropped 14%", body: "Mobile applicants are dropping at the resume upload step.", action: "Investigate funnel" },
  { id: 3, type: "anomaly", severity: "high", confidence: 95, impact: "High", title: "Profile traffic surged 32%", body: "Surge driven by Backend Engineer post and LinkedIn referrals.", action: "Capture momentum" },
  { id: 4, type: "win", severity: "low", confidence: 99, impact: "Positive", title: "Backend Engineering yields top quality", body: "These roles have 41% qualified applicant rate vs 22% average.", action: "Boost spend" },
] as const;

export const performanceTrend = Array.from({ length: 30 }, (_, i) => ({
  day: `D${i + 1}`,
  brand: 60 + Math.round(Math.sin(i / 4) * 8 + i * 0.6),
  hires: 2 + Math.round(Math.cos(i / 5) * 1.5 + i * 0.15),
  apps: 60 + Math.round(Math.sin(i / 3) * 14 + i * 1.8),
  funnel: 18 + Math.round(Math.cos(i / 4) * 3 + i * 0.25),
}));

export const funnelStages = [
  { stage: "Profile Visitors", volume: 124800, conv: 100, drop: 0, delta: 12 },
  { stage: "Job Viewers", volume: 58200, conv: 46.6, drop: 53.4, delta: 8 },
  { stage: "Apply Clicks", volume: 21400, conv: 36.8, drop: 63.2, delta: 6 },
  { stage: "Started", volume: 12800, conv: 59.8, drop: 40.2, delta: -3 },
  { stage: "Submitted", volume: 8420, conv: 65.8, drop: 34.2, delta: 14 },
  { stage: "Screened", volume: 3120, conv: 37.1, drop: 62.9, delta: 2 },
  { stage: "Shortlisted", volume: 1480, conv: 47.4, drop: 52.6, delta: 5 },
  { stage: "Interviewed", volume: 612, conv: 41.4, drop: 58.6, delta: 9 },
  { stage: "Offers", volume: 108, conv: 17.6, drop: 82.4, delta: 3 },
  { stage: "Hired", volume: 84, conv: 77.8, drop: 22.2, delta: 14 },
] as const;

export const topJobs = [
  { title: "Senior Backend Engineer", dept: "Engineering", views: 12480, clicks: 1820, apps: 642, qualified: 312, interviews: 88, hires: 12, conv: 5.1 },
  { title: "Product Designer", dept: "Design", views: 9210, clicks: 1410, apps: 520, qualified: 248, interviews: 72, hires: 9, conv: 5.6 },
  { title: "Engineering Manager", dept: "Engineering", views: 7820, clicks: 980, apps: 312, qualified: 190, interviews: 54, hires: 7, conv: 4.0 },
  { title: "Growth Marketer", dept: "Marketing", views: 6510, clicks: 880, apps: 280, qualified: 142, interviews: 38, hires: 5, conv: 4.3 },
  { title: "Data Scientist", dept: "Data", views: 5840, clicks: 760, apps: 244, qualified: 118, interviews: 32, hires: 4, conv: 4.2 },
  { title: "Customer Success Lead", dept: "CS", views: 4980, clicks: 620, apps: 210, qualified: 96, interviews: 24, hires: 3, conv: 4.2 },
] as const;

export const audienceGeo = [
  { region: "North America", value: 42 },
  { region: "Europe", value: 31 },
  { region: "Asia Pacific", value: 18 },
  { region: "LATAM", value: 6 },
  { region: "Other", value: 3 },
];

export const trafficSources = [
  { source: "Organic", value: 38 },
  { source: "Direct", value: 24 },
  { source: "Social", value: 18 },
  { source: "Referral", value: 12 },
  { source: "Paid", value: 8 },
];

export const topContent = [
  { post: "Inside our remote-first culture", views: 18420, eng: 2810, shares: 412 },
  { post: "Meet the Engineering team", views: 14210, eng: 2104, shares: 318 },
  { post: "We're hiring across 12 roles", views: 11820, eng: 1640, shares: 280 },
  { post: "Behind the product roadmap", views: 9820, eng: 1322, shares: 198 },
];

export const emergingSkills = [
  { skill: "AI Engineering", demand: 94, supply: 38 },
  { skill: "RAG Systems", demand: 88, supply: 22 },
  { skill: "Platform Engineering", demand: 81, supply: 54 },
  { skill: "Rust", demand: 76, supply: 41 },
  { skill: "Product Analytics", demand: 72, supply: 60 },
];

export const benchmarks = [
  { metric: "Brand Score", you: 82, industry: 71, competitors: 78 },
  { metric: "Conversion %", you: 4.2, industry: 3.1, competitors: 3.8 },
  { metric: "Time To Hire (d)", you: 21, industry: 32, competitors: 27 },
  { metric: "Offer Acceptance %", you: 78, industry: 71, competitors: 74 },
  { metric: "Response Rate %", you: 86, industry: 74, competitors: 80 },
];

export const alerts = [
  { id: 1, severity: "high", title: "Application drop detected", body: "Mobile completion down 14% in last 48h." },
  { id: 2, severity: "medium", title: "Profile traffic surge", body: "+32% organic views, capacity to capture leads." },
  { id: 3, severity: "low", title: "Funnel bottleneck", body: "Screening stage backlog growing at +9%/day." },
];