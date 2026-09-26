import type {
  RoleType,
  Seniority,
  ParsedIntent,
  Candidate,
} from "./Index";

// ─── Role keyword maps ────────────────────────────────────────────────────────

const ROLE_KEYWORDS: Record<RoleType, string[]> = {
  frontend: [
    "frontend", "front-end", "front end", "react", "vue", "angular", "svelte",
    "typescript", "javascript", "css", "tailwind", "next.js", "nextjs", "remix",
    "webpack", "vite", "ui engineer", "web developer", "web engineer", "html",
    "design system", "component library", "webgl", "canvas",
  ],
  backend: [
    "backend", "back-end", "back end", "node", "node.js", "python", "golang", "go",
    "ruby", "java", "spring", "rust", "api", "server", "microservices", "postgres",
    "postgresql", "mysql", "redis", "kafka", "grpc", "rest api", "graphql server",
    "infrastructure", "platform engineer",
  ],
  fullstack: [
    "fullstack", "full-stack", "full stack", "generalist", "end-to-end",
    "web developer", "both frontend and backend",
  ],
  design: [
    "designer", "ux", "ui/ux", "user experience", "product design", "figma",
    "sketch", "prototype", "wireframe", "user research", "interaction design",
    "visual design", "brand design", "design lead",
  ],
  sales: [
    "sales", "account executive", "ae", "bdr", "sdr", "business development",
    "revenue", "quota", "crm", "salesforce", "pipeline", "account manager",
    "enterprise sales", "closing deals", "closing", "outbound", "inbound sales",
  ],
  marketing: [
    "marketing", "content", "seo", "growth", "brand", "campaign", "copywriter",
    "demand generation", "growth marketer", "performance marketing", "paid acquisition",
    "content strategy", "editorial", "cro",
  ],
  data: [
    "data scientist", "data science", "data engineer", "data engineering",
    "machine learning", "ml engineer", "ml", "ai", "artificial intelligence",
    "spark", "airflow", "dbt", "analytics engineer", "sql analyst", "bi",
    "tableau", "looker", "a/b testing", "statistics", "causal inference",
  ],
  product: [
    "product manager", "pm", "product management", "roadmap", "product strategy",
    "product owner", "product lead", "head of product", "cpo",
  ],
  management: [
    "engineering manager", "em", "manager", "director of engineering",
    "vp engineering", "vp of engineering", "head of engineering", "tech lead",
    "team lead", "cto", "chief technology", "director", "people manager",
    "lead a team", "manage engineers", "engineering leader",
  ],
  general: [],
};

const SENIORITY_KEYWORDS: Record<Seniority, string[]> = {
  junior: ["junior", "entry", "entry-level", "entry level", "0-2 years", "new grad", "graduate", "intern"],
  mid: ["mid", "intermediate", "2-5 years", "3-5 years", "3+ years", "mid-level"],
  senior: ["senior", "sr.", "sr ", "5+ years", "experienced", "5 years", "6 years"],
  staff: ["staff", "7+ years", "7 years", "8 years"],
  lead: ["lead", "tech lead", "technical lead", "team lead"],
  principal: ["principal", "distinguished"],
  executive: [
    "vp", "vice president", "director", "head of", "chief", "cto", "cpo", "cmo",
    "executive", "c-level", "c-suite",
  ],
};

// A broad list of tech / domain terms to extract as keywords from the prompt
const KNOWN_KEYWORDS = new Set([
  "react", "vue", "angular", "svelte", "typescript", "javascript", "css", "tailwind",
  "next.js", "nextjs", "remix", "webpack", "vite", "graphql", "rest", "api",
  "node", "node.js", "python", "go", "golang", "rust", "ruby", "rails", "java", "spring",
  "postgres", "postgresql", "mysql", "mongodb", "redis", "kafka", "spark", "airflow", "dbt",
  "snowflake", "bigquery", "redshift", "sql", "nosql", "docker", "kubernetes", "k8s", "aws",
  "gcp", "azure", "terraform", "linux", "git", "ci/cd", "devops",
  "pytorch", "tensorflow", "jax", "sklearn", "ml", "llm", "langchain",
  "figma", "sketch", "framer", "storybook", "design systems", "accessibility", "a11y",
  "salesforce", "hubspot", "crm", "seo", "analytics", "looker", "tableau", "mixpanel",
  "stripe", "payments", "fintech", "b2b", "saas", "startup", "enterprise",
  "mobile", "ios", "android", "react native", "flutter", "expo",
]);

// ─── parsePrompt ─────────────────────────────────────────────────────────────

export function parsePrompt(raw: string): ParsedIntent {
  const lower = raw.toLowerCase();

  // Detect role type — score each type by keyword hit count
  const roleScores = (Object.entries(ROLE_KEYWORDS) as [RoleType, string[]][]).map(
    ([type, kws]) => ({ type, hits: kws.filter((kw) => lower.includes(kw)).length })
  );
  roleScores.sort((a, b) => b.hits - a.hits);
  const roleType: RoleType = roleScores[0].hits > 0 ? roleScores[0].type : "general";

  // Detect seniority
  let seniority: Seniority = "senior"; // default
  for (const [level, kws] of Object.entries(SENIORITY_KEYWORDS) as [Seniority, string[]][]) {
    if (kws.some((kw) => lower.includes(kw))) {
      seniority = level;
      break; // first match wins (ordered from junior → executive)
    }
  }

  // Detect remote
  const remote = /\bremote\b|distributed|work.?from.?home|wfh/.test(lower);

  // Detect city / location
  const CITIES = [
    "san francisco", "new york", "nyc", "los angeles", "seattle", "chicago",
    "boston", "austin", "denver", "toronto", "london", "berlin", "amsterdam",
    "paris", "stockholm", "sydney", "singapore",
  ];
  const location = CITIES.find((city) => lower.includes(city)) ?? null;

  // Extract domain keywords
  const words = lower.split(/[\s,;.()/]+/);
  const keywords = words.filter((w) => KNOWN_KEYWORDS.has(w));

  // Also capture multi-word phrases
  for (const kw of KNOWN_KEYWORDS) {
    if (kw.includes(" ") && lower.includes(kw) && !keywords.includes(kw)) {
      keywords.push(kw);
    }
  }

  return { raw, roleType, seniority, keywords: [...new Set(keywords)], remote, location };
}

// ─── buildFilterGroups ────────────────────────────────────────────────────────

export interface FilterGroup {
  group: "location" | "experience" | "skills";
  label: string;
  options: string[];
}

export function buildFilterGroups(candidates: Candidate[]): FilterGroup[] {
  // Location: unique simplified city names, up to 4
  const locations = [
    ...new Set(
      candidates.map((c) => {
        const loc = c.location.toLowerCase();
        if (loc.includes("remote")) return "Remote";
        const city = c.location.split(",")[0].trim();
        return city;
      })
    ),
  ].slice(0, 4);

  // Skills: top skills by frequency across the result set, up to 4
  const skillCounts = new Map<string, number>();
  for (const c of candidates) {
    for (const s of c.skills) {
      skillCounts.set(s, (skillCounts.get(s) ?? 0) + 1);
    }
  }
  const topSkills = [...skillCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([skill]) => skill);

  // Experience: only include ranges present in the candidate set
  const expOptions: string[] = [];
  if (candidates.some((c) => c.yearsExp >= 3 && c.yearsExp < 5)) expOptions.push("3–5 yrs");
  if (candidates.some((c) => c.yearsExp >= 5 && c.yearsExp <= 8)) expOptions.push("5–8 yrs");
  if (candidates.some((c) => c.yearsExp > 8)) expOptions.push("8+ yrs");

  const groups: FilterGroup[] = [
    { group: "location",   label: "Location",   options: locations },
    { group: "experience", label: "Experience", options: expOptions },
    { group: "skills",     label: "Skills",     options: topSkills },
  ];
  return groups.filter((g) => g.options.length > 0);
}

// ─── buildJobDescription ─────────────────────────────────────────────────────

