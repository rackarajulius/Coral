export const reputationOverview = {
  rating: 4.3,
  totalReviews: 1482,
  healthScore: 82,
  healthStatus: "Excellent",
  trend: "+0.3 this quarter",
};

export const kpiCards = [
  { id: "total", label: "Total Reviews", value: "1,482", change: 12.4, previous: "1,318 last quarter" },
  { id: "employees", label: "Employee Reviews", value: "964", change: 8.1, previous: "892" },
  { id: "candidates", label: "Candidate Reviews", value: "518", change: 21.6, previous: "426" },
  { id: "rating", label: "Average Rating", value: "4.3", change: 2.4, previous: "4.2" },
  { id: "response", label: "Response Rate", value: "87%", change: 4.2, previous: "83%" },
  { id: "rtime", label: "Avg Response Time", value: "6.4h", change: -18.0, previous: "7.8h" },
  { id: "sentiment", label: "Sentiment Score", value: "78", change: 3.1, previous: "76" },
  { id: "month", label: "Reviews This Month", value: "164", change: 14.0, previous: "144" },
];

export const categoryRatings = [
  { label: "Employee Satisfaction", score: 4.4, change: 0.2, spark: [4.0, 4.1, 4.1, 4.2, 4.3, 4.4] },
  { label: "Candidate Experience", score: 4.1, change: -0.1, spark: [4.3, 4.3, 4.2, 4.2, 4.1, 4.1] },
  { label: "Work-Life Balance", score: 4.5, change: 0.3, spark: [4.1, 4.2, 4.3, 4.3, 4.4, 4.5] },
  { label: "Leadership", score: 3.9, change: -0.2, spark: [4.2, 4.1, 4.1, 4.0, 4.0, 3.9] },
  { label: "Compensation", score: 3.7, change: -0.1, spark: [3.9, 3.8, 3.8, 3.8, 3.7, 3.7] },
  { label: "Benefits", score: 4.2, change: 0.1, spark: [4.0, 4.0, 4.1, 4.1, 4.2, 4.2] },
  { label: "Career Growth", score: 3.8, change: 0.0, spark: [3.8, 3.8, 3.7, 3.8, 3.8, 3.8] },
  { label: "Company Culture", score: 4.6, change: 0.2, spark: [4.3, 4.4, 4.4, 4.5, 4.5, 4.6] },
  { label: "Diversity & Inclusion", score: 4.2, change: 0.3, spark: [3.8, 3.9, 4.0, 4.1, 4.1, 4.2] },
  { label: "Remote Work", score: 4.7, change: 0.4, spark: [4.2, 4.3, 4.4, 4.5, 4.6, 4.7] },
];

export const volumeTrend = Array.from({ length: 12 }, (_, i) => ({
  month: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
  reviews: Math.round(80 + Math.sin(i / 2) * 30 + i * 6),
  rating: +(4.0 + Math.sin(i / 3) * 0.3 + i * 0.02).toFixed(2),
  sentiment: Math.round(65 + Math.sin(i / 2.5) * 8 + i * 0.8),
}));

export const ratingDistribution = [
  { stars: 5, count: 712, pct: 48 },
  { stars: 4, count: 489, pct: 33 },
  { stars: 3, count: 163, pct: 11 },
  { stars: 2, count: 74, pct: 5 },
  { stars: 1, count: 44, pct: 3 },
];

export const reviewSources = [
  { name: "Current Employees", value: 42 },
  { name: "Former Employees", value: 23 },
  { name: "Candidates", value: 18 },
  { name: "Interviewees", value: 9 },
  { name: "Contractors", value: 5 },
  { name: "Interns", value: 3 },
];

export const geoBreakdown = [
  { region: "North America", reviews: 712 },
  { region: "Europe", reviews: 384 },
  { region: "Asia Pacific", reviews: 246 },
  { region: "LATAM", reviews: 88 },
  { region: "MEA", reviews: 52 },
];

export const departmentBreakdown = [
  { dept: "Engineering", reviews: 384 },
  { dept: "Product", reviews: 168 },
  { dept: "Design", reviews: 124 },
  { dept: "Sales", reviews: 246 },
  { dept: "Marketing", reviews: 142 },
  { dept: "Operations", reviews: 168 },
  { dept: "Customer Support", reviews: 156 },
  { dept: "HR", reviews: 94 },
];

export const sentimentBreakdown = { positive: 72, neutral: 18, negative: 10 };

export const sentimentTrend = Array.from({ length: 12 }, (_, i) => ({
  month: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
  positive: Math.round(60 + Math.sin(i / 2) * 8 + i),
  neutral: Math.round(22 - Math.sin(i / 2) * 4),
  negative: Math.round(18 - i * 0.6),
}));

export const sentimentByDept = [
  { dept: "Engineering", positive: 78, neutral: 14, negative: 8 },
  { dept: "Product", positive: 82, neutral: 12, negative: 6 },
  { dept: "Design", positive: 88, neutral: 8, negative: 4 },
  { dept: "Sales", positive: 64, neutral: 22, negative: 14 },
  { dept: "Marketing", positive: 76, neutral: 16, negative: 8 },
  { dept: "Operations", positive: 68, neutral: 22, negative: 10 },
  { dept: "Support", positive: 60, neutral: 24, negative: 16 },
  { dept: "HR", positive: 80, neutral: 14, negative: 6 },
];

export const topicInsights = [
  { topic: "Remote Work", mentions: 428, positive: 92, negative: 4, trend: 18 },
  { topic: "Leadership", mentions: 312, positive: 58, negative: 28, trend: -6 },
  { topic: "Compensation", mentions: 286, positive: 42, negative: 38, trend: 12 },
  { topic: "Career Growth", mentions: 248, positive: 56, negative: 24, trend: 4 },
  { topic: "Culture", mentions: 384, positive: 86, negative: 6, trend: 8 },
  { topic: "Flexibility", mentions: 312, positive: 90, negative: 4, trend: 14 },
  { topic: "Benefits", mentions: 198, positive: 78, negative: 12, trend: 2 },
  { topic: "Hiring Process", mentions: 224, positive: 64, negative: 22, trend: -8 },
  { topic: "Management", mentions: 256, positive: 62, negative: 24, trend: -4 },
  { topic: "Communication", mentions: 172, positive: 54, negative: 28, trend: -2 },
];

export const strengths = [
  "Supportive and collaborative culture across teams",
  "Flexible remote-first work arrangements",
  "Strong learning & development opportunities",
  "Generous parental leave and benefits package",
];

export const improvements = [
  "Greater transparency on promotion criteria",
  "Compensation benchmarking against industry peers",
  "Streamline cross-team communication tooling",
  "Faster interview scheduling for candidates",
];

export type ReviewerType = "Current Employee" | "Former Employee" | "Candidate" | "Interviewee" | "Contractor" | "Intern";

export const reviews = [
  {
    id: "r1",
    reviewer: "Senior Software Engineer",
    type: "Current Employee" as ReviewerType,
    department: "Engineering",
    location: "San Francisco, CA",
    tenure: "3+ years",
    date: "Nov 28, 2025",
    rating: 5,
    sentiment: "positive" as const,
    verified: true,
    helpful: 42,
    trending: true,
    responded: true,
    title: "Best company I've worked for in a decade",
    body: "The engineering culture genuinely values craftsmanship. Code reviews are thoughtful, deploys are calm, and leadership protects deep work time. The hybrid policy is real — no theater, no badge tracking.",
    pros: "Strong engineering culture, real autonomy, supportive managers, excellent benefits, transparent comp bands.",
    cons: "Performance review cycles can feel rushed. Some internal tools need polish.",
    categories: { Culture: 5, Leadership: 4, Compensation: 4, Benefits: 5, "Career Growth": 4, "Work-Life Balance": 5 },
  },
  {
    id: "r2",
    reviewer: "Software Engineering Candidate",
    type: "Candidate" as ReviewerType,
    department: "Engineering",
    location: "Remote",
    tenure: "Interviewed in Nov 2025",
    date: "Nov 24, 2025",
    rating: 2,
    sentiment: "negative" as const,
    verified: true,
    helpful: 18,
    trending: false,
    responded: false,
    title: "Slow and inconsistent interview process",
    body: "Five rounds spread across seven weeks with long silences in between. Recruiter changed mid-process and I had to re-explain context. Technical loop was solid, but coordination needs work.",
    pros: "Interviewers were knowledgeable and respectful. Technical questions reflected real work.",
    cons: "Slow scheduling. Ghosted for two weeks after the final round. Compensation discussed only at the end.",
    categories: { Culture: 3, Leadership: 3, Compensation: 2, Benefits: 3, "Career Growth": 3, "Work-Life Balance": 3 },
  },
  {
    id: "r3",
    reviewer: "Product Designer",
    type: "Former Employee" as ReviewerType,
    department: "Design",
    location: "London, UK",
    tenure: "2 years",
    date: "Nov 20, 2025",
    rating: 4,
    sentiment: "positive" as const,
    verified: true,
    helpful: 27,
    trending: false,
    responded: true,
    title: "Great craft, growth slowed in year two",
    body: "I learned more in my first year here than any previous role. Design has a real seat at the table. Promotion paths became unclear as the team grew quickly.",
    pros: "Beautiful product, talented peers, generous learning budget.",
    cons: "Career laddering needs investment. Compensation lagged market for senior IC roles.",
    categories: { Culture: 5, Leadership: 4, Compensation: 3, Benefits: 4, "Career Growth": 3, "Work-Life Balance": 4 },
  },
  {
    id: "r4",
    reviewer: "Account Executive",
    type: "Current Employee" as ReviewerType,
    department: "Sales",
    location: "New York, NY",
    tenure: "1 year",
    date: "Nov 16, 2025",
    rating: 3,
    sentiment: "neutral" as const,
    verified: true,
    helpful: 14,
    trending: false,
    responded: false,
    title: "Great product, quota math is tough",
    body: "The product is genuinely easy to sell and prospects respond well. Territory carving has been uneven this year and quotas were raised without commensurate pipeline support.",
    pros: "Strong product-market fit, supportive SE team, good comp on-target.",
    cons: "Pipeline coverage uneven. Enablement is reactive rather than proactive.",
    categories: { Culture: 4, Leadership: 3, Compensation: 4, Benefits: 4, "Career Growth": 3, "Work-Life Balance": 3 },
  },
  {
    id: "r5",
    reviewer: "Software Engineering Intern",
    type: "Intern" as ReviewerType,
    department: "Engineering",
    location: "Toronto, CA",
    tenure: "Summer 2025",
    date: "Nov 12, 2025",
    rating: 5,
    sentiment: "positive" as const,
    verified: true,
    helpful: 9,
    trending: false,
    responded: true,
    title: "Best internship I could've asked for",
    body: "Shipped meaningful code to production in week three. Mentor met with me weekly and challenged me. The intern cohort events were a highlight.",
    pros: "Real ownership, great mentorship, fair pay.",
    cons: "Onboarding documentation could be more current.",
    categories: { Culture: 5, Leadership: 5, Compensation: 4, Benefits: 4, "Career Growth": 5, "Work-Life Balance": 5 },
  },
  {
    id: "r6",
    reviewer: "Customer Support Specialist",
    type: "Former Employee" as ReviewerType,
    department: "Customer Support",
    location: "Remote",
    tenure: "18 months",
    date: "Nov 8, 2025",
    rating: 2,
    sentiment: "negative" as const,
    verified: true,
    helpful: 31,
    trending: true,
    responded: false,
    title: "Burnout in support is real",
    body: "Volume grew faster than the team. Despite raising flags, headcount didn't follow until people started leaving. Leadership eventually responded but the trust gap remains.",
    pros: "Genuinely kind teammates. Remote work is real.",
    cons: "Chronic understaffing. Limited upward mobility. Comp below market for tenured agents.",
    categories: { Culture: 3, Leadership: 2, Compensation: 2, Benefits: 3, "Career Growth": 2, "Work-Life Balance": 2 },
  },
];

export const responseTemplates = [
  { id: "t1", name: "Thank Positive Reviewer", body: "Thank you for the thoughtful review. We're glad to hear..." },
  { id: "t2", name: "Candidate Feedback Response", body: "Thank you for taking the time to interview with us..." },
  { id: "t3", name: "Address Workplace Concern", body: "We appreciate you sharing this feedback. We take this seriously..." },
  { id: "t4", name: "Hiring Experience Response", body: "We're sorry your hiring experience didn't meet expectations..." },
];

export const aiSummary =
  "Employee sentiment remains highly positive, with culture and remote flexibility driving the strongest signals (+8% mention growth). Recent concerns center on compensation competitiveness in Sales and Support, and on promotion transparency in Engineering. Candidate satisfaction is trending down (-6%) due to interview scheduling latency.";

export const emergingThemes = [
  { label: "Remote work praise increasing", trend: 18, tone: "positive" as const },
  { label: "Compensation concerns rising", trend: 12, tone: "negative" as const },
  { label: "Candidate satisfaction improving in Design", trend: 9, tone: "positive" as const },
  { label: "Leadership sentiment slipping in Sales", trend: -7, tone: "negative" as const },
];

export const riskAlerts = [
  { level: "high", text: "Negative reviews increased 15% in Customer Support" },
  { level: "medium", text: "Leadership sentiment declining in Sales (-8 pts)" },
  { level: "medium", text: "Interview experience ratings dropping (-0.3)" },
];

export const recommendations = [
  { action: "Publish promotion framework for Engineering & Design", impact: 86, priority: "High", owner: "People Ops" },
  { action: "Re-benchmark Sales & Support compensation bands", impact: 78, priority: "High", owner: "Total Rewards" },
  { action: "Reduce average interview cycle from 7 → 4 weeks", impact: 72, priority: "Medium", owner: "Talent Acquisition" },
  { action: "Launch monthly Q&A with CSupport leadership", impact: 58, priority: "Medium", owner: "Support Leadership" },
];

export const benchmarks = [
  { metric: "Overall Rating", you: 4.3, industry: 3.9, top: 4.6 },
  { metric: "Candidate Experience", you: 4.1, industry: 3.7, top: 4.5 },
  { metric: "Culture", you: 4.6, industry: 4.0, top: 4.7 },
  { metric: "Leadership", you: 3.9, industry: 3.8, top: 4.4 },
  { metric: "Compensation", you: 3.7, industry: 3.8, top: 4.3 },
  { metric: "Benefits", you: 4.2, industry: 3.9, top: 4.5 },
];

export const notifications = [
  { id: "n1", level: "high", title: "Negative review awaiting response", desc: "2-star review from Customer Support · 4h ago", time: "4h" },
  { id: "n2", level: "medium", title: "Candidate satisfaction declined", desc: "Engineering interview NPS dropped 8 points this week", time: "1d" },
  { id: "n3", level: "info", title: "Monthly reputation report ready", desc: "November 2025 executive summary is available", time: "2d" },
  { id: "n4", level: "info", title: "New 5-star review received", desc: "From a Software Engineering Intern · Toronto", time: "3d" },
];
