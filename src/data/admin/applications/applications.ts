export type ApplicationStatus =
  | "Submitted"
  | "Under Review"
  | "Shortlisted"
  | "Interview"
  | "Rejected"
  | "Withdrawn"
  | "Flagged";

export type RiskLevel = "Low" | "Medium" | "High";

export interface Application {
  id: string;
  applicant: {
    name: string;
    email: string;
    phone: string;
    avatar: string;
    location: string;
    profileCompletion: number;
  };
  job: {
    title: string;
    employer: string;
    location: string;
    salary: string;
    type: string;
    postedDate: string;
    status: string;
  };
  appliedDate: string;
  status: ApplicationStatus;
  screeningScore: number;
  riskLevel: RiskLevel;
  riskReason: string;
  resume: boolean;
  coverLetter: string;
  screeningQuestions: {
    question: string;
    answer: string;
    passed: boolean;
  }[];
  timeline: {
    event: string;
    date: string;
    actor?: string;
  }[];
}

export const mockApplications: Application[] = [
  {
    id: "APP-001",
    applicant: {
      name: "Sarah Thompson",
      email: "sarah.thompson@email.com",
      phone: "+1 (555) 234-5678",
      avatar: "ST",
      location: "San Francisco, CA",
      profileCompletion: 92,
    },
    job: {
      title: "Backend Engineer",
      employer: "MapleTech",
      location: "San Francisco, CA",
      salary: "$120,000 - $160,000",
      type: "Full-time",
      postedDate: "2024-01-15",
      status: "Active",
    },
    appliedDate: "2024-02-01",
    status: "Shortlisted",
    screeningScore: 82,
    riskLevel: "Low",
    riskReason: "All checks passed",
    resume: true,
    coverLetter: "I am writing to express my strong interest in the Backend Engineer position at MapleTech. With over 5 years of experience in distributed systems and microservices architecture, I believe I would be a valuable addition to your engineering team.",
    screeningQuestions: [
      { question: "Years of backend experience?", answer: "5+ years", passed: true },
      { question: "Experience with distributed systems?", answer: "Yes, led migration to microservices", passed: true },
      { question: "Available to start within 2 weeks?", answer: "Yes", passed: true },
    ],
    timeline: [
      { event: "Application submitted", date: "2024-02-01" },
      { event: "Resume screened", date: "2024-02-02", actor: "System" },
      { event: "Moved to shortlist", date: "2024-02-05", actor: "HR Team" },
    ],
  },
  {
    id: "APP-002",
    applicant: {
      name: "Michael Chen",
      email: "m.chen@email.com",
      phone: "+1 (555) 345-6789",
      avatar: "MC",
      location: "Chicago, IL",
      profileCompletion: 78,
    },
    job: {
      title: "Warehouse Associate",
      employer: "Northern Logistics",
      location: "Chicago, IL",
      salary: "$38,000 - $45,000",
      type: "Full-time",
      postedDate: "2024-01-20",
      status: "Active",
    },
    appliedDate: "2024-02-03",
    status: "Under Review",
    screeningScore: 61,
    riskLevel: "Low",
    riskReason: "All checks passed",
    resume: true,
    coverLetter: "I am interested in the Warehouse Associate position. I have 3 years of warehouse experience and am forklift certified.",
    screeningQuestions: [
      { question: "Forklift certified?", answer: "Yes", passed: true },
      { question: "Available for night shifts?", answer: "Prefer day shifts", passed: false },
    ],
    timeline: [
      { event: "Application submitted", date: "2024-02-03" },
      { event: "Under review", date: "2024-02-04", actor: "System" },
    ],
  },
  {
    id: "APP-003",
    applicant: {
      name: "Emily Rogers",
      email: "emily.r@email.com",
      phone: "+1 (555) 456-7890",
      avatar: "ER",
      location: "Austin, TX",
      profileCompletion: 95,
    },
    job: {
      title: "UX Designer",
      employer: "PixelCraft",
      location: "Remote",
      salary: "$90,000 - $120,000",
      type: "Full-time",
      postedDate: "2024-01-10",
      status: "Active",
    },
    appliedDate: "2024-01-28",
    status: "Interview",
    screeningScore: 89,
    riskLevel: "Low",
    riskReason: "All checks passed",
    resume: true,
    coverLetter: "As a UX designer with 7 years of experience, I am thrilled to apply for this role at PixelCraft. My portfolio includes award-winning work for Fortune 500 companies.",
    screeningQuestions: [
      { question: "Portfolio link?", answer: "emilyrogers.design", passed: true },
      { question: "Experience with design systems?", answer: "Built 3 from scratch", passed: true },
      { question: "Figma proficiency?", answer: "Expert level", passed: true },
    ],
    timeline: [
      { event: "Application submitted", date: "2024-01-28" },
      { event: "Resume screened", date: "2024-01-29", actor: "System" },
      { event: "Phone screen completed", date: "2024-02-02", actor: "HR" },
      { event: "Interview scheduled", date: "2024-02-06", actor: "Hiring Manager" },
    ],
  },
  {
    id: "APP-004",
    applicant: {
      name: "Daniel Brooks",
      email: "d.brooks@email.com",
      phone: "+1 (555) 567-8901",
      avatar: "DB",
      location: "Miami, FL",
      profileCompletion: 45,
    },
    job: {
      title: "Sales Rep",
      employer: "Horizon Telecom",
      location: "Miami, FL",
      salary: "$50,000 + commission",
      type: "Full-time",
      postedDate: "2024-01-25",
      status: "Active",
    },
    appliedDate: "2024-02-05",
    status: "Flagged",
    screeningScore: 42,
    riskLevel: "High",
    riskReason: "Multiple applications in 24 hours, incomplete profile",
    resume: false,
    coverLetter: "",
    screeningQuestions: [
      { question: "Sales experience?", answer: "Some", passed: false },
      { question: "CRM tools used?", answer: "None", passed: false },
    ],
    timeline: [
      { event: "Application submitted", date: "2024-02-05" },
      { event: "Flagged by system", date: "2024-02-05", actor: "Anti-fraud" },
    ],
  },
  {
    id: "APP-005",
    applicant: {
      name: "Olivia Martin",
      email: "o.martin@email.com",
      phone: "+1 (555) 678-9012",
      avatar: "OM",
      location: "Denver, CO",
      profileCompletion: 88,
    },
    job: {
      title: "IT Support",
      employer: "Core Systems",
      location: "Denver, CO",
      salary: "$55,000 - $70,000",
      type: "Full-time",
      postedDate: "2024-01-18",
      status: "Active",
    },
    appliedDate: "2024-01-30",
    status: "Rejected",
    screeningScore: 73,
    riskLevel: "Medium",
    riskReason: "Profile flagged for inconsistent work history",
    resume: true,
    coverLetter: "I have a strong background in IT support with certifications in CompTIA A+ and Network+. I am seeking a challenging role where I can leverage my skills.",
    screeningQuestions: [
      { question: "IT certifications?", answer: "CompTIA A+, Network+", passed: true },
      { question: "Experience with ticketing systems?", answer: "ServiceNow, Jira", passed: true },
      { question: "On-call availability?", answer: "No", passed: false },
    ],
    timeline: [
      { event: "Application submitted", date: "2024-01-30" },
      { event: "Resume screened", date: "2024-01-31", actor: "System" },
      { event: "Rejected", date: "2024-02-04", actor: "Hiring Manager" },
    ],
  },
  {
    id: "APP-006",
    applicant: {
      name: "James Wilson",
      email: "j.wilson@email.com",
      phone: "+1 (555) 789-0123",
      avatar: "JW",
      location: "New York, NY",
      profileCompletion: 100,
    },
    job: {
      title: "Product Manager",
      employer: "LaunchPad Inc",
      location: "New York, NY",
      salary: "$140,000 - $180,000",
      type: "Full-time",
      postedDate: "2024-01-12",
      status: "Active",
    },
    appliedDate: "2024-01-25",
    status: "Interview",
    screeningScore: 94,
    riskLevel: "Low",
    riskReason: "All checks passed",
    resume: true,
    coverLetter: "With 8 years of product management experience at leading tech companies, I am excited about the opportunity to drive product strategy at LaunchPad.",
    screeningQuestions: [
      { question: "Years of PM experience?", answer: "8 years", passed: true },
      { question: "Experience with B2B SaaS?", answer: "Yes, 5 years", passed: true },
    ],
    timeline: [
      { event: "Application submitted", date: "2024-01-25" },
      { event: "Resume screened", date: "2024-01-26", actor: "System" },
      { event: "Phone screen", date: "2024-01-30", actor: "HR" },
      { event: "Technical interview scheduled", date: "2024-02-03", actor: "VP Product" },
    ],
  },
  {
    id: "APP-007",
    applicant: {
      name: "Ana Garcia",
      email: "ana.g@email.com",
      phone: "+1 (555) 890-1234",
      avatar: "AG",
      location: "Los Angeles, CA",
      profileCompletion: 70,
    },
    job: {
      title: "Marketing Coordinator",
      employer: "BrightWave Media",
      location: "Los Angeles, CA",
      salary: "$55,000 - $65,000",
      type: "Full-time",
      postedDate: "2024-01-22",
      status: "Active",
    },
    appliedDate: "2024-02-02",
    status: "Submitted",
    screeningScore: 68,
    riskLevel: "Low",
    riskReason: "All checks passed",
    resume: true,
    coverLetter: "I am a recent marketing graduate with strong skills in social media management and content creation.",
    screeningQuestions: [
      { question: "Social media platforms managed?", answer: "Instagram, TikTok, LinkedIn", passed: true },
      { question: "Content creation tools?", answer: "Canva, Adobe Suite", passed: true },
    ],
    timeline: [
      { event: "Application submitted", date: "2024-02-02" },
    ],
  },
  {
    id: "APP-008",
    applicant: {
      name: "Robert Kim",
      email: "r.kim@email.com",
      phone: "+1 (555) 901-2345",
      avatar: "RK",
      location: "Seattle, WA",
      profileCompletion: 60,
    },
    job: {
      title: "Data Analyst",
      employer: "InsightHub",
      location: "Seattle, WA",
      salary: "$80,000 - $100,000",
      type: "Full-time",
      postedDate: "2024-01-16",
      status: "Active",
    },
    appliedDate: "2024-02-04",
    status: "Withdrawn",
    screeningScore: 55,
    riskLevel: "Low",
    riskReason: "All checks passed",
    resume: true,
    coverLetter: "",
    screeningQuestions: [
      { question: "SQL proficiency?", answer: "Intermediate", passed: true },
      { question: "Python experience?", answer: "Basic", passed: false },
    ],
    timeline: [
      { event: "Application submitted", date: "2024-02-04" },
      { event: "Withdrawn by applicant", date: "2024-02-06" },
    ],
  },
];
