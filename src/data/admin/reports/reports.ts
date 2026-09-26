export type ReportType = "Spam" | "Fraud" | "Harassment" | "Fake Listing" | "Discrimination" | "Scam" | "Inappropriate Content" | "Identity Theft";
export type ReportSeverity = "Low" | "Medium" | "High";
export type ReportStatus = "Open" | "In Review" | "Escalated" | "Resolved" | "Dismissed";

export interface Report {
  id: string;
  type: ReportType;
  entity: {
    name: string;
    type: "Employer" | "Jobseeker" | "Job Listing";
    id: string;
  };
  reason: string;
  severity: ReportSeverity;
  status: ReportStatus;
  assignedTo: string | null;
  reportedBy: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  riskSignals: { label: string; active: boolean }[];
  timeline: { event: string; date: string; actor?: string }[];
  internalNotes: { note: string; author: string; date: string }[];
}

export const mockReports: Report[] = [
  {
    id: "RPT-001",
    type: "Fraud",
    entity: { name: "QuickHire Solutions", type: "Employer", id: "EMP-412" },
    reason: "Fake company requesting personal banking information from applicants",
    severity: "High",
    status: "Escalated",
    assignedTo: "Sarah M.",
    reportedBy: "James Wilson",
    createdAt: "2024-02-08",
    updatedAt: "2024-02-09",
    description: "Multiple applicants reported that QuickHire Solutions requested banking details during the initial application process. The company profile has inconsistent information and was created 3 days ago. The listed address does not correspond to any registered business.",
    riskSignals: [
      { label: "Multiple reports (4)", active: true },
      { label: "New account (<7 days)", active: true },
      { label: "Keyword match: banking info", active: true },
      { label: "IP anomaly detected", active: true },
    ],
    timeline: [
      { event: "Report created", date: "2024-02-08", actor: "James Wilson" },
      { event: "Auto-flagged by system", date: "2024-02-08", actor: "System" },
      { event: "Assigned to Sarah M.", date: "2024-02-08", actor: "Admin" },
      { event: "Escalated to Trust & Safety", date: "2024-02-09", actor: "Sarah M." },
    ],
    internalNotes: [
      { note: "Confirmed fake address via Google Maps. Recommend immediate suspension.", author: "Sarah M.", date: "2024-02-09" },
    ],
  },
  {
    id: "RPT-002",
    type: "Spam",
    entity: { name: "Daniel Brooks", type: "Jobseeker", id: "JS-891" },
    reason: "Mass-applying to unrelated positions with identical cover letter",
    severity: "Low",
    status: "Open",
    assignedTo: null,
    reportedBy: "MapleTech HR",
    createdAt: "2024-02-09",
    updatedAt: "2024-02-09",
    description: "This jobseeker has applied to 47 positions in the last 24 hours across various industries with the same generic cover letter. Multiple employers have flagged the behavior.",
    riskSignals: [
      { label: "High volume applications", active: true },
      { label: "Duplicate cover letters", active: true },
      { label: "New account (<7 days)", active: false },
      { label: "IP anomaly detected", active: false },
    ],
    timeline: [
      { event: "Report created", date: "2024-02-09", actor: "MapleTech HR" },
    ],
    internalNotes: [],
  },
  {
    id: "RPT-003",
    type: "Fake Listing",
    entity: { name: "Remote Data Entry - $80/hr", type: "Job Listing", id: "JOB-2341" },
    reason: "Unrealistic salary and vague job description suggesting phishing",
    severity: "High",
    status: "In Review",
    assignedTo: "Mike R.",
    reportedBy: "System Auto-Detection",
    createdAt: "2024-02-07",
    updatedAt: "2024-02-08",
    description: "Automated detection flagged this listing for unrealistic compensation ($80/hr for data entry), vague requirements, and external links to non-verified domains. The employer account was created 2 days before posting.",
    riskSignals: [
      { label: "Multiple reports (2)", active: true },
      { label: "New account (<7 days)", active: true },
      { label: "Keyword match: external link", active: true },
      { label: "IP anomaly detected", active: false },
    ],
    timeline: [
      { event: "Auto-detected", date: "2024-02-07", actor: "System" },
      { event: "Report created", date: "2024-02-07", actor: "System" },
      { event: "Assigned to Mike R.", date: "2024-02-08", actor: "Admin" },
    ],
    internalNotes: [
      { note: "External links redirect to a phishing page. Flagging domain.", author: "Mike R.", date: "2024-02-08" },
    ],
  },
  {
    id: "RPT-004",
    type: "Harassment",
    entity: { name: "TechBro Industries", type: "Employer", id: "EMP-223" },
    reason: "Inappropriate language in rejection emails sent to female applicants",
    severity: "High",
    status: "In Review",
    assignedTo: "Sarah M.",
    reportedBy: "Emily Rogers",
    createdAt: "2024-02-06",
    updatedAt: "2024-02-08",
    description: "Applicant reported receiving rejection emails containing inappropriate and gendered language. Screenshots have been provided. Two additional applicants have since filed similar reports.",
    riskSignals: [
      { label: "Multiple reports (3)", active: true },
      { label: "New account (<7 days)", active: false },
      { label: "Keyword match: inappropriate", active: true },
      { label: "IP anomaly detected", active: false },
    ],
    timeline: [
      { event: "Report created", date: "2024-02-06", actor: "Emily Rogers" },
      { event: "Additional report filed", date: "2024-02-07", actor: "Ana Garcia" },
      { event: "Assigned to Sarah M.", date: "2024-02-07", actor: "Admin" },
      { event: "Under investigation", date: "2024-02-08", actor: "Sarah M." },
    ],
    internalNotes: [
      { note: "Screenshots verified. Preparing formal warning.", author: "Sarah M.", date: "2024-02-08" },
    ],
  },
  {
    id: "RPT-005",
    type: "Discrimination",
    entity: { name: "Heritage Foods Corp", type: "Employer", id: "EMP-567" },
    reason: "Job listing specifies age and gender preferences",
    severity: "Medium",
    status: "Resolved",
    assignedTo: "Mike R.",
    reportedBy: "Olivia Martin",
    createdAt: "2024-02-04",
    updatedAt: "2024-02-06",
    description: "The job listing for 'Front Desk Receptionist' included phrases like 'young and energetic female preferred.' This violates employment equity policies.",
    riskSignals: [
      { label: "Multiple reports (1)", active: false },
      { label: "New account (<7 days)", active: false },
      { label: "Keyword match: age, gender", active: true },
      { label: "IP anomaly detected", active: false },
    ],
    timeline: [
      { event: "Report created", date: "2024-02-04", actor: "Olivia Martin" },
      { event: "Assigned to Mike R.", date: "2024-02-04", actor: "Admin" },
      { event: "Listing removed", date: "2024-02-05", actor: "Mike R." },
      { event: "Employer warned", date: "2024-02-06", actor: "Mike R." },
      { event: "Resolved", date: "2024-02-06", actor: "Mike R." },
    ],
    internalNotes: [
      { note: "Listing removed. First offense — formal warning issued.", author: "Mike R.", date: "2024-02-06" },
    ],
  },
  {
    id: "RPT-006",
    type: "Scam",
    entity: { name: "GlobalPay Recruiting", type: "Employer", id: "EMP-901" },
    reason: "Charging applicants a 'processing fee' before interview",
    severity: "High",
    status: "Open",
    assignedTo: null,
    reportedBy: "Robert Kim",
    createdAt: "2024-02-09",
    updatedAt: "2024-02-09",
    description: "Applicant was asked to pay $49.99 as a 'background check processing fee' before being considered for a Warehouse Manager position. Payment link leads to an unverified third-party processor.",
    riskSignals: [
      { label: "Multiple reports (2)", active: true },
      { label: "New account (<7 days)", active: true },
      { label: "Keyword match: payment, fee", active: true },
      { label: "IP anomaly detected", active: true },
    ],
    timeline: [
      { event: "Report created", date: "2024-02-09", actor: "Robert Kim" },
    ],
    internalNotes: [],
  },
  {
    id: "RPT-007",
    type: "Inappropriate Content",
    entity: { name: "NightLife Events Co.", type: "Employer", id: "EMP-334" },
    reason: "Job listing contains suggestive imagery and inappropriate descriptions",
    severity: "Medium",
    status: "Dismissed",
    assignedTo: "Sarah M.",
    reportedBy: "Ana Garcia",
    createdAt: "2024-02-03",
    updatedAt: "2024-02-05",
    description: "The listing for 'Event Promoter' was flagged for suggestive promotional images. Upon review, the images were promotional material for a legitimate nightclub event. Descriptions updated by employer after warning.",
    riskSignals: [
      { label: "Multiple reports (1)", active: false },
      { label: "New account (<7 days)", active: false },
      { label: "Keyword match: suggestive", active: true },
      { label: "IP anomaly detected", active: false },
    ],
    timeline: [
      { event: "Report created", date: "2024-02-03", actor: "Ana Garcia" },
      { event: "Assigned to Sarah M.", date: "2024-02-03", actor: "Admin" },
      { event: "Reviewed — legitimate business", date: "2024-02-04", actor: "Sarah M." },
      { event: "Dismissed", date: "2024-02-05", actor: "Sarah M." },
    ],
    internalNotes: [
      { note: "Legitimate business. Images were event promos. Employer updated descriptions voluntarily.", author: "Sarah M.", date: "2024-02-05" },
    ],
  },
  {
    id: "RPT-008",
    type: "Identity Theft",
    entity: { name: "Michael Chen", type: "Jobseeker", id: "JS-442" },
    reason: "Account using stolen identity documents for verification",
    severity: "High",
    status: "Escalated",
    assignedTo: "Sarah M.",
    reportedBy: "System Auto-Detection",
    createdAt: "2024-02-08",
    updatedAt: "2024-02-09",
    description: "System detected that the uploaded ID documents belong to a different individual based on facial recognition mismatch. The account has been applying to positions requiring security clearance.",
    riskSignals: [
      { label: "Multiple reports (1)", active: false },
      { label: "New account (<7 days)", active: true },
      { label: "Keyword match: identity mismatch", active: true },
      { label: "IP anomaly detected", active: true },
    ],
    timeline: [
      { event: "Auto-detected by verification system", date: "2024-02-08", actor: "System" },
      { event: "Report created", date: "2024-02-08", actor: "System" },
      { event: "Assigned to Sarah M.", date: "2024-02-08", actor: "Admin" },
      { event: "Escalated to legal", date: "2024-02-09", actor: "Sarah M." },
    ],
    internalNotes: [
      { note: "Forwarded to legal team. Account suspended pending investigation.", author: "Sarah M.", date: "2024-02-09" },
    ],
  },
];
