/**
 * Brand entries as they are actually stored.
 *
 * `id` is optional on purpose: the editor's zod schema declares it required,
 * but rows already in the database were written without one. Treating it as
 * guaranteed gave every list item a React key of `undefined`.
 */
export interface WhyCard { id?: string; icon?: string; title: string; description?: string }
export interface CoreValue { id?: string; icon?: string; title: string; description?: string }
export interface Award {
  id?: string; title: string; organization: string; year: string;
  description?: string; badgeUrl?: string;
}
export interface DeiStat { id?: string; label: string; value: string }
export interface GalleryPhoto { id?: string; url: string; caption?: string }

/**
 * The employer's own profile as it reaches a job card.
 *
 * The brand fields below are returned only by the job *detail* endpoint — a
 * list row carries none of them, and every consumer must treat absent and
 * never-filled-in identically.
 */
export interface CompanyProfile {
  id?: string | null;
  tagline?: string | null;
  description?: string | null;
  website?: string | null;
  industry?: string | null;
  size?: string | null;
  headquarters?: string | null;
  foundedYear?: number | null;
  culture?: string | null;
  benefits?: string[];
  verified?: boolean;
  mission?: string | null;
  whyWorkHere?: WhyCard[];
  coreValues?: CoreValue[];
  awards?: Award[];
  diversityStatement?: string | null;
  deiStats?: DeiStat[];
  galleryPhotos?: GalleryPhoto[];
}

export interface Job {
  id: string;
  title: string;
  company: string;
  icon: string;
  location: string;
  type: string;
  salary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  tags: string[];
  postedAt: string;
  /** How to apply, set by whoever posted the job. Defaults to Quick Apply. */
  applicationMethod?: "internal" | "external" | "email";
  applicationUrl?: string | null;
  applicationEmail?: string | null;
  /** The employer's own company info, from their profile. */
  companyProfile?: CompanyProfile | null;
  /** Open now (true), or gathering candidates for future openings (false). Unstated: null. */
  existingVacancy?: boolean | null;
  /** The posting says AI is used to screen, assess or select applicants. */
  usesAi?: boolean;
}

export const mockJobs: Job[] = [
  {
    id: "1",
    title: "Senior Frontend Developer",
    company: "Google.",
    icon:"google.png",
    location: "San Francisco, CA",
    type: "Full-time",
    salary: "$140k - $180k",
    description:
      "We're looking for a Senior Frontend Developer to join our growing team. You'll be responsible for building and maintaining our web applications using modern technologies like React, TypeScript, and Tailwind CSS. This is an exciting opportunity to work on products used by millions of users worldwide.",
    responsibilities: [
      "Lead the development of new features and improvements to our web platform",
      "Collaborate with designers and product managers to create intuitive user experiences",
      "Write clean, maintainable, and well-tested code",
      "Mentor junior developers and contribute to code reviews",
      "Participate in architectural decisions and technical planning",
    ],
    requirements: [
      "5+ years of experience in frontend development",
      "Strong proficiency in React, TypeScript, and modern CSS",
      "Experience with state management solutions (Redux, Zustand, etc.)",
      "Familiarity with testing frameworks (Jest, React Testing Library)",
      "Excellent communication and collaboration skills",
    ],
    benefits: [
      "Competitive salary and equity package",
      "Comprehensive health, dental, and vision insurance",
      "Flexible work schedule and remote options",
      "Generous PTO and parental leave",
      "Professional development budget",
    ],
    tags: ["React", "TypeScript", "Tailwind CSS", "Node.js"],
    postedAt: "2d ago",
  },
  {
    id: "2",
    title: "Product Designer",
    company: "Adobe",
    icon:"adobe.png",
    location: "New York, NY",
    type: "Full-time",
    salary: "$120k - $150k",
    description:
      "Join our design team to create beautiful and functional products. You'll work closely with engineers and product managers to design user interfaces that delight our customers. We value creativity, attention to detail, and user-centered thinking.",
    responsibilities: [
      "Design intuitive and visually appealing user interfaces",
      "Create wireframes, prototypes, and high-fidelity mockups",
      "Conduct user research and usability testing",
      "Develop and maintain design systems and component libraries",
      "Collaborate with cross-functional teams throughout the product lifecycle",
    ],
    requirements: [
      "4+ years of experience in product or UX design",
      "Proficiency in Figma and other design tools",
      "Strong portfolio showcasing web and mobile design work",
      "Understanding of accessibility and inclusive design principles",
      "Experience with design systems and component-based design",
    ],
    benefits: [
      "Competitive compensation package",
      "Health and wellness benefits",
      "Creative work environment",
      "Annual design conference budget",
      "Flexible remote work policy",
    ],
    tags: ["Figma", "UI/UX", "Design Systems", "Prototyping"],
    postedAt: "1w ago",
  },
  {
    id: "3",
    title: "Backend Engineer",
    company: "Meta",
    icon:"meta.png",
    location: "Seattle, WA",
    type: "Full-time",
    salary: "$150k - $190k",
    description:
      "We're seeking a talented Backend Engineer to help us build scalable infrastructure. You'll be working on systems that handle millions of requests per day, using cutting-edge technologies and best practices in distributed systems.",
    responsibilities: [
      "Design and implement scalable backend services and APIs",
      "Optimize database performance and query efficiency",
      "Build and maintain CI/CD pipelines",
      "Monitor system health and respond to incidents",
      "Document technical specifications and architecture decisions",
    ],
    requirements: [
      "5+ years of backend development experience",
      "Strong knowledge of Python, Go, or Java",
      "Experience with cloud platforms (AWS, GCP, or Azure)",
      "Familiarity with containerization and orchestration (Docker, Kubernetes)",
      "Understanding of microservices architecture patterns",
    ],
    benefits: [
      "Top-tier compensation and stock options",
      "Unlimited PTO policy",
      "Home office setup allowance",
      "Learning and development budget",
      "Team offsites and events",
    ],
    tags: ["Python", "AWS", "PostgreSQL", "Docker", "Kubernetes"],
    postedAt: "3d ago",
  },
  {
    id: "4",
    title: "Mobile Developer",
    company: "Spotify",
    icon:"spotify.png",
    location: "Austin, TX",
    type: "Full-time",
    salary: "$130k - $160k",
    description:
      "Join us to build the next generation of mobile applications. We're looking for someone passionate about creating smooth, performant apps that users love. You'll have the opportunity to work on both iOS and Android platforms.",
    responsibilities: [
      "Develop and maintain cross-platform mobile applications",
      "Implement new features based on product requirements",
      "Ensure app performance and responsiveness",
      "Collaborate with backend team on API integration",
      "Stay updated with mobile development trends and best practices",
    ],
    requirements: [
      "3+ years of mobile development experience",
      "Proficiency in React Native or Flutter",
      "Experience with native iOS (Swift) or Android (Kotlin) development",
      "Understanding of mobile app architecture patterns",
      "Published apps on App Store or Google Play",
    ],
    benefits: [
      "Competitive salary with annual bonuses",
      "Latest devices for development and testing",
      "Flexible working hours",
      "Health and dental coverage",
      "Monthly team activities",
    ],
    tags: ["React Native", "iOS", "Android", "TypeScript"],
    postedAt: "5d ago",
  },
  {
    id: "5",
    title: "DevOps Engineer",
    company: "Apple",
    icon:"apple.png",
    location: "Remote",
    type: "Full-time",
    salary: "$145k - $175k",
    description:
      "We're looking for a DevOps Engineer to help us automate and optimize our infrastructure. You'll be responsible for building reliable systems that support our growing engineering team and ensure high availability of our services.",
    responsibilities: [
      "Design and implement infrastructure as code solutions",
      "Manage cloud infrastructure across multiple environments",
      "Automate deployment and monitoring processes",
      "Implement security best practices and compliance measures",
      "Support development teams with tooling and platform improvements",
    ],
    requirements: [
      "4+ years of DevOps or SRE experience",
      "Strong experience with Terraform or Pulumi",
      "Expertise in AWS or GCP services",
      "Knowledge of monitoring tools (Prometheus, Grafana, DataDog)",
      "Scripting skills in Python or Bash",
    ],
    benefits: [
      "Fully remote position",
      "Competitive salary and equity",
      "Home office budget",
      "Unlimited learning resources",
      "Quarterly team meetups",
    ],
    tags: ["AWS", "Terraform", "Kubernetes", "CI/CD", "Linux"],
    postedAt: "1d ago",
  },
  {
    id: "6",
    title: "Data Scientist",
    company: "Microsoft",
    icon:"microsoft.png",
    location: "Boston, MA",
    type: "Full-time",
    salary: "$135k - $170k",
    description:
      "Join our data science team to extract insights from complex datasets and build machine learning models. You'll work on challenging problems that directly impact business decisions and product development.",
    responsibilities: [
      "Analyze large datasets to identify patterns and trends",
      "Build and deploy machine learning models",
      "Collaborate with product teams to define metrics and experiments",
      "Create data visualizations and reports for stakeholders",
      "Develop and maintain data pipelines",
    ],
    requirements: [
      "Master's or PhD in a quantitative field",
      "3+ years of data science experience",
      "Strong programming skills in Python and SQL",
      "Experience with ML frameworks (TensorFlow, PyTorch, scikit-learn)",
      "Excellent statistical analysis and modeling skills",
    ],
    benefits: [
      "Competitive compensation package",
      "Conference and publication support",
      "Flexible work arrangements",
      "Comprehensive benefits",
      "Collaborative research environment",
    ],
    tags: ["Python", "Machine Learning", "SQL", "TensorFlow", "Statistics"],
    postedAt: "4d ago",
  },
];
