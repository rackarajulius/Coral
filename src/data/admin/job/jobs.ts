export interface JobTimelineEvent {
  action: string;
  by?: string;
  date: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  location: string;
  type: "Full-time" | "Part-time" | "Contract" | "Internship";
  salaryMin?: number;
  salaryMax?: number;
  salaryUnit?: string;
  currency?: string;
  postedDate: string;
  applications: number;
  status: "Active" | "Pending" | "Flagged" | "Rejected" | "Expired" | "Suspended";
  risk: "Low" | "Medium" | "High";
  description?: string;
  responsibilities?: string[];
  requirements?: string[];
  benefits?: string[];
  industry?: string;
  expiryDate?: string;
  duplicateDetected?: boolean;
  spamKeywords?: boolean;
  timeline?: JobTimelineEvent[];
}

export const mockJobs: Job[] = [
  {
    id: "1",
    title: "Senior Backend Engineer",
    company: "MapleTech Solutions",
    location: "Toronto, CA",
    type: "Full-time",
    salaryMin: 120000,
    salaryMax: 145000,
    currency: "$",
    postedDate: "2026-02-10",
    applications: 87,
    status: "Active",
    risk: "Low",
    description: "We are looking for a Senior Backend Engineer to join our growing team and help build scalable microservices architecture.",
    responsibilities: [
      "Design and implement scalable backend services",
      "Lead code reviews and mentor junior developers",
      "Collaborate with product and frontend teams",
      "Optimize database queries and system performance",
    ],
    requirements: [
      "5+ years of backend development experience",
      "Proficiency in Node.js, Python, or Go",
      "Experience with PostgreSQL and Redis",
      "Strong understanding of distributed systems",
    ],
    benefits: [
      "Competitive salary and equity",
      "Remote-first culture",
      "Health and dental benefits",
      "Learning and development budget",
    ],
    industry: "Technology",
    expiryDate: "2026-04-10",
    duplicateDetected: false,
    spamKeywords: false,
    timeline: [
      { action: "Posted", by: "Employer", date: "2026-02-10" },
      { action: "Reviewed by admin", by: "Admin", date: "2026-02-10" },
      { action: "Approved", by: "Admin", date: "2026-02-10" },
      { action: "First application received", date: "2026-02-11" },
    ],
  },
  {
    id: "2",
    title: "Warehouse Associate",
    company: "Northern Logistics",
    location: "Calgary, CA",
    type: "Full-time",
    salaryMin: 22,
    salaryMax: 30,
    salaryUnit: "/hr",
    currency: "$",
    postedDate: "2026-02-12",
    applications: 12,
    status: "Pending",
    risk: "Low",
    description: "Join our warehouse team and help manage inventory operations for one of Canada's largest logistics companies.",
    responsibilities: [
      "Pick, pack, and ship customer orders",
      "Maintain organized warehouse environment",
      "Operate warehouse equipment safely",
    ],
    requirements: [
      "Physical ability to lift up to 50 lbs",
      "Reliable transportation",
      "Previous warehouse experience preferred",
    ],
    benefits: [
      "Overtime opportunities",
      "Health benefits after 3 months",
      "Employee discount program",
    ],
    industry: "Logistics",
    expiryDate: "2026-03-15",
    duplicateDetected: false,
    spamKeywords: false,
    timeline: [
      { action: "Posted", by: "Employer", date: "2026-02-12" },
      { action: "Pending review", by: "System", date: "2026-02-12" },
    ],
  },
  {
    id: "3",
    title: "Remote UX Designer",
    company: "PixelCraft Studio",
    location: "Remote",
    type: "Contract",
    salaryMin: 85000,
    salaryMax: 95000,
    currency: "$",
    postedDate: "2026-02-08",
    applications: 54,
    status: "Active",
    risk: "Medium",
    description: "We need a talented UX Designer to lead the redesign of our flagship product.",
    responsibilities: [
      "Conduct user research and usability testing",
      "Create wireframes and high-fidelity prototypes",
      "Collaborate with engineering on implementation",
    ],
    requirements: [
      "3+ years of UX design experience",
      "Proficiency in Figma",
      "Strong portfolio demonstrating user-centered design",
    ],
    benefits: [
      "Flexible schedule",
      "Equipment stipend",
      "Conference attendance budget",
    ],
    industry: "Design",
    expiryDate: "2026-05-01",
    duplicateDetected: true,
    spamKeywords: false,
    timeline: [
      { action: "Posted", by: "Employer", date: "2026-02-08" },
      { action: "Duplicate flag raised", by: "System", date: "2026-02-08" },
      { action: "Approved with warning", by: "Admin", date: "2026-02-09" },
    ],
  },
  {
    id: "4",
    title: "Sales Representative",
    company: "Horizon Telecom",
    location: "Vancouver, CA",
    type: "Full-time",
    salaryMin: 60000,
    salaryMax: 80000,
    currency: "$",
    postedDate: "2026-02-05",
    applications: 33,
    status: "Flagged",
    risk: "High",
    description: "Drive new business growth through strategic sales and relationship building.",
    responsibilities: [
      "Prospect and close new business accounts",
      "Meet or exceed monthly sales targets",
      "Maintain CRM records and pipeline reporting",
    ],
    requirements: [
      "2+ years of B2B sales experience",
      "Strong communication skills",
      "Self-motivated and results-driven",
    ],
    benefits: [
      "Uncapped commissions",
      "Car allowance",
      "President's Club trips",
    ],
    industry: "Telecommunications",
    expiryDate: "2026-03-20",
    duplicateDetected: false,
    spamKeywords: true,
    timeline: [
      { action: "Posted", by: "Employer", date: "2026-02-05" },
      { action: "Spam keyword detected", by: "System", date: "2026-02-05" },
      { action: "Flagged for review", by: "Admin", date: "2026-02-06" },
    ],
  },
  {
    id: "5",
    title: "IT Support Technician",
    company: "Core Systems Ltd",
    location: "Ottawa, CA",
    type: "Full-time",
    salaryMin: 55000,
    salaryMax: 65000,
    currency: "$",
    postedDate: "2026-02-01",
    applications: 4,
    status: "Rejected",
    risk: "Medium",
    description: "Provide first-line technical support and maintain IT infrastructure.",
    responsibilities: [
      "Respond to and resolve support tickets",
      "Maintain hardware and software inventory",
      "Assist with onboarding and offboarding",
    ],
    requirements: [
      "CompTIA A+ or equivalent certification",
      "Experience with Windows and macOS administration",
      "Strong troubleshooting skills",
    ],
    benefits: [
      "Professional development budget",
      "Flexible work arrangements",
      "Team events",
    ],
    industry: "IT Services",
    expiryDate: "2026-02-28",
    duplicateDetected: false,
    spamKeywords: false,
    timeline: [
      { action: "Posted", by: "Employer", date: "2026-02-01" },
      { action: "Reviewed", by: "Admin", date: "2026-02-02" },
      { action: "Rejected", by: "Admin", date: "2026-02-03" },
    ],
  },
  {
    id: "6",
    title: "Marketing Manager",
    company: "BrightPath Media",
    location: "Montreal, CA",
    type: "Full-time",
    salaryMin: 90000,
    salaryMax: 110000,
    currency: "$",
    postedDate: "2026-02-14",
    applications: 28,
    status: "Active",
    risk: "Low",
    industry: "Marketing",
    expiryDate: "2026-04-14",
    duplicateDetected: false,
    spamKeywords: false,
    timeline: [
      { action: "Posted", by: "Employer", date: "2026-02-14" },
      { action: "Approved", by: "Admin", date: "2026-02-14" },
    ],
  },
  {
    id: "7",
    title: "DevOps Engineer",
    company: "CloudNine Infrastructure",
    location: "Remote",
    type: "Full-time",
    salaryMin: 130000,
    salaryMax: 155000,
    currency: "$",
    postedDate: "2026-01-28",
    applications: 62,
    status: "Expired",
    risk: "Low",
    industry: "Technology",
    expiryDate: "2026-02-14",
    duplicateDetected: false,
    spamKeywords: false,
    timeline: [
      { action: "Posted", by: "Employer", date: "2026-01-28" },
      { action: "Approved", by: "Admin", date: "2026-01-28" },
      { action: "Expired", by: "System", date: "2026-02-14" },
    ],
  },
  {
    id: "8",
    title: "Customer Success Associate",
    company: "SaaSFlow Inc",
    location: "Toronto, CA",
    type: "Full-time",
    salaryMin: 52000,
    salaryMax: 62000,
    currency: "$",
    postedDate: "2026-02-13",
    applications: 19,
    status: "Active",
    risk: "Low",
    industry: "SaaS",
    expiryDate: "2026-04-01",
    duplicateDetected: false,
    spamKeywords: false,
    timeline: [
      { action: "Posted", by: "Employer", date: "2026-02-13" },
      { action: "Approved", by: "Admin", date: "2026-02-13" },
    ],
  },
  {
    id: "9",
    title: "Data Analyst Intern",
    company: "InsightLab Analytics",
    location: "Waterloo, CA",
    type: "Internship",
    salaryMin: 20,
    salaryMax: 25,
    salaryUnit: "/hr",
    currency: "$",
    postedDate: "2026-02-11",
    applications: 41,
    status: "Pending",
    risk: "Low",
    industry: "Analytics",
    expiryDate: "2026-03-30",
    duplicateDetected: false,
    spamKeywords: false,
    timeline: [
      { action: "Posted", by: "Employer", date: "2026-02-11" },
      { action: "Pending review", by: "System", date: "2026-02-11" },
    ],
  },
  {
    id: "10",
    title: "Financial Controller",
    company: "Sterling Accounting Group",
    location: "Edmonton, CA",
    type: "Full-time",
    salaryMin: 105000,
    salaryMax: 125000,
    currency: "$",
    postedDate: "2026-02-09",
    applications: 7,
    status: "Active",
    risk: "Low",
    industry: "Finance",
    expiryDate: "2026-04-09",
    duplicateDetected: false,
    spamKeywords: false,
    timeline: [
      { action: "Posted", by: "Employer", date: "2026-02-09" },
      { action: "Approved", by: "Admin", date: "2026-02-09" },
    ],
  },
];

export const kpiData = {
  totalJobs: 12842,
  activeJobs: 8421,
  pendingApproval: 93,
  flagged: 37,
  expired: 2184,
  rejected: 128,
};
