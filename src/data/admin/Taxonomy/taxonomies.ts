export interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  parent?: string;
  order: number;
  status: "active" | "inactive";
  type: string;
  dependencyCount: number;
}

export interface TaxonomyType {
  id: string;
  label: string;
  description: string;
  items: TaxonomyItem[];
}

export const taxonomyTypes: TaxonomyType[] = [
  {
    id: "job-categories",
    label: "Job Categories",
    description: "Primary classification for job postings",
    items: [
      { id: "cat-1", name: "Technology", slug: "technology", description: "Software, IT, and tech roles", order: 1, status: "active", type: "Category", dependencyCount: 1243 },
      { id: "cat-2", name: "Healthcare", slug: "healthcare", description: "Medical and health services", order: 2, status: "active", type: "Category", dependencyCount: 876 },
      { id: "cat-3", name: "Finance", slug: "finance", description: "Banking, accounting, and financial services", order: 3, status: "active", type: "Category", dependencyCount: 654 },
      { id: "cat-4", name: "Education", slug: "education", description: "Teaching and academic roles", order: 4, status: "active", type: "Category", dependencyCount: 432 },
      { id: "cat-5", name: "Marketing", slug: "marketing", description: "Marketing and communications", order: 5, status: "active", type: "Category", dependencyCount: 321 },
      { id: "cat-6", name: "Engineering", slug: "engineering", description: "Civil, mechanical, electrical engineering", order: 6, status: "inactive", type: "Category", dependencyCount: 0 },
    ],
  },
  {
    id: "job-types",
    label: "Job Types",
    description: "Employment arrangement classifications",
    items: [
      { id: "type-1", name: "Full-time", slug: "full-time", description: "Standard full-time employment", order: 1, status: "active", type: "Type", dependencyCount: 8432 },
      { id: "type-2", name: "Part-time", slug: "part-time", description: "Part-time employment", order: 2, status: "active", type: "Type", dependencyCount: 2134 },
      { id: "type-3", name: "Contract", slug: "contract", description: "Fixed-term contract positions", order: 3, status: "active", type: "Type", dependencyCount: 1567 },
      { id: "type-4", name: "Freelance", slug: "freelance", description: "Freelance and gig work", order: 4, status: "active", type: "Type", dependencyCount: 876 },
      { id: "type-5", name: "Internship", slug: "internship", description: "Internship and co-op positions", order: 5, status: "active", type: "Type", dependencyCount: 345 },
    ],
  },
  {
    id: "locations",
    label: "Locations",
    description: "Default Canadian provinces and territories",
    items: [
      { id: "loc-1", name: "Ontario", slug: "ontario", description: "Province of Ontario", order: 1, status: "active", type: "Province", dependencyCount: 4521 },
      { id: "loc-2", name: "British Columbia", slug: "british-columbia", description: "Province of British Columbia", order: 2, status: "active", type: "Province", dependencyCount: 2876 },
      { id: "loc-3", name: "Alberta", slug: "alberta", description: "Province of Alberta", order: 3, status: "active", type: "Province", dependencyCount: 1987 },
      { id: "loc-4", name: "Quebec", slug: "quebec", description: "Province of Quebec", order: 4, status: "active", type: "Province", dependencyCount: 1654 },
      { id: "loc-5", name: "Manitoba", slug: "manitoba", description: "Province of Manitoba", order: 5, status: "active", type: "Province", dependencyCount: 543 },
      { id: "loc-6", name: "Saskatchewan", slug: "saskatchewan", description: "Province of Saskatchewan", order: 6, status: "active", type: "Province", dependencyCount: 321 },
      { id: "loc-7", name: "Nova Scotia", slug: "nova-scotia", description: "Province of Nova Scotia", order: 7, status: "active", type: "Province", dependencyCount: 234 },
      { id: "loc-8", name: "New Brunswick", slug: "new-brunswick", description: "Province of New Brunswick", order: 8, status: "active", type: "Province", dependencyCount: 187 },
      { id: "loc-9", name: "Prince Edward Island", slug: "prince-edward-island", description: "Province of Prince Edward Island", order: 9, status: "active", type: "Province", dependencyCount: 76 },
      { id: "loc-10", name: "Newfoundland and Labrador", slug: "newfoundland-labrador", description: "Province of Newfoundland and Labrador", order: 10, status: "active", type: "Province", dependencyCount: 123 },
    ],
  },
  {
    id: "salary-ranges",
    label: "Salary Ranges",
    description: "Standardized compensation brackets",
    items: [
      { id: "sal-1", name: "$30,000 – $50,000", slug: "30k-50k", description: "Entry level", order: 1, status: "active", type: "Range", dependencyCount: 2341 },
      { id: "sal-2", name: "$50,000 – $75,000", slug: "50k-75k", description: "Mid-level", order: 2, status: "active", type: "Range", dependencyCount: 3456 },
      { id: "sal-3", name: "$75,000 – $100,000", slug: "75k-100k", description: "Senior", order: 3, status: "active", type: "Range", dependencyCount: 2876 },
      { id: "sal-4", name: "$100,000 – $150,000", slug: "100k-150k", description: "Lead / Principal", order: 4, status: "active", type: "Range", dependencyCount: 1234 },
      { id: "sal-5", name: "$150,000+", slug: "150k-plus", description: "Executive", order: 5, status: "active", type: "Range", dependencyCount: 543 },
    ],
  },
  {
    id: "experience-levels",
    label: "Experience Levels",
    description: "Career stage classifications",
    items: [
      { id: "exp-1", name: "Entry Level", slug: "entry-level", description: "0–2 years experience", order: 1, status: "active", type: "Level", dependencyCount: 3456 },
      { id: "exp-2", name: "Mid Level", slug: "mid-level", description: "3–5 years experience", order: 2, status: "active", type: "Level", dependencyCount: 4567 },
      { id: "exp-3", name: "Senior", slug: "senior", description: "6–10 years experience", order: 3, status: "active", type: "Level", dependencyCount: 2345 },
      { id: "exp-4", name: "Lead", slug: "lead", description: "10+ years experience", order: 4, status: "active", type: "Level", dependencyCount: 876 },
      { id: "exp-5", name: "Executive", slug: "executive", description: "C-suite and VP roles", order: 5, status: "active", type: "Level", dependencyCount: 234 },
    ],
  },
  {
    id: "industries",
    label: "Industries",
    description: "Business sector classifications",
    items: [
      { id: "ind-1", name: "Information Technology", slug: "information-technology", description: "Tech and software companies", order: 1, status: "active", type: "Industry", dependencyCount: 5432 },
      { id: "ind-2", name: "Financial Services", slug: "financial-services", description: "Banks, insurance, investment", order: 2, status: "active", type: "Industry", dependencyCount: 2345 },
      { id: "ind-3", name: "Healthcare", slug: "healthcare", description: "Hospitals, clinics, pharma", order: 3, status: "active", type: "Industry", dependencyCount: 1876 },
      { id: "ind-4", name: "Retail", slug: "retail", description: "Consumer retail and e-commerce", order: 4, status: "active", type: "Industry", dependencyCount: 1543 },
      { id: "ind-5", name: "Manufacturing", slug: "manufacturing", description: "Production and manufacturing", order: 5, status: "active", type: "Industry", dependencyCount: 987 },
    ],
  },
  {
    id: "skills",
    label: "Skills",
    description: "Technical and soft skill tags",
    items: [
      { id: "skill-1", name: "JavaScript", slug: "javascript", description: "Programming language", order: 1, status: "active", type: "Technical", dependencyCount: 4321 },
      { id: "skill-2", name: "Python", slug: "python", description: "Programming language", order: 2, status: "active", type: "Technical", dependencyCount: 3456 },
      { id: "skill-3", name: "Project Management", slug: "project-management", description: "Soft skill", order: 3, status: "active", type: "Soft", dependencyCount: 2345 },
      { id: "skill-4", name: "Communication", slug: "communication", description: "Soft skill", order: 4, status: "active", type: "Soft", dependencyCount: 5678 },
      { id: "skill-5", name: "SQL", slug: "sql", description: "Database query language", order: 5, status: "active", type: "Technical", dependencyCount: 2876 },
    ],
  },
  {
    id: "education-levels",
    label: "Education Levels",
    description: "Academic qualification tiers",
    items: [
      { id: "edu-1", name: "High School Diploma", slug: "high-school", description: "Secondary education", order: 1, status: "active", type: "Education", dependencyCount: 6543 },
      { id: "edu-2", name: "Associate Degree", slug: "associate", description: "2-year degree", order: 2, status: "active", type: "Education", dependencyCount: 2345 },
      { id: "edu-3", name: "Bachelor's Degree", slug: "bachelors", description: "4-year undergraduate degree", order: 3, status: "active", type: "Education", dependencyCount: 8765 },
      { id: "edu-4", name: "Master's Degree", slug: "masters", description: "Graduate degree", order: 4, status: "active", type: "Education", dependencyCount: 3456 },
      { id: "edu-5", name: "Doctorate", slug: "doctorate", description: "PhD or equivalent", order: 5, status: "active", type: "Education", dependencyCount: 876 },
    ],
  },
];
