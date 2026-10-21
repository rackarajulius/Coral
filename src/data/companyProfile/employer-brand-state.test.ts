import assert from "node:assert/strict";
import test from "node:test";
import type { EmployerCompany } from "@/lib/api/employerCompany";
import { calcProfileStrength, defaultEmployerBrand } from "./employer-brand-schema.ts";
import {
  brandToCompanyPayload,
  hydrateEmployerBrand,
  parseEmployerBrandDraft,
  serializeEmployerBrandDraft,
} from "./employer-brand-state.ts";

const company: EmployerCompany = {
  id: "company-c", userId: "employer-c", companyId: null,
  companyName: "Coral QA Company C", companyLogo: null, companyWebsite: null,
  companySize: "1-10", industry: "Technology", jobTitle: "Recruiter", department: null,
  isHiringManager: true, isRecruiter: true, isAdmin: false,
  companyDescription: null, companyBenefits: [], companyCulture: null,
  culturePhilosophy: null, cultureCollaboration: null, cultureImageUrl: null,
  headquarters: "Toronto, Ontario, Canada", companyLocations: [], socialLinks: [],
  supportEmail: null, supportPhone: null, tagline: null, companyBanner: null,
  foundedYear: null, industries: [], locations: [], coreValues: [], galleryPhotos: [],
  whyWorkHere: [], awards: [], diversityStatement: null, deiStats: [], cultureVideoUrl: null,
  overview: null, mission: null, vision: null, visibility: "public", showJobs: true,
  allowFollow: true, verificationStatus: "unverified", createdAt: "2026-10-08", updatedAt: "2026-10-08",
};

// A v1 automatic draft after onboarding replaced only the saved name/HQ/size.
const legacyDraft = {
  displayName: company.companyName, headquarters: company.headquarters, companySize: company.companySize,
  tagline: "Building the operating system for modern teams.", foundedYear: "2019",
  industries: ["SaaS", "Developer Tools"], website: "https://acmetech.com",
  locations: [
    { id: "l1", city: "San Francisco", country: "United States", isHQ: true },
    { id: "l2", city: "London", country: "United Kingdom" },
    { id: "l3", city: "Berlin", country: "Germany" },
  ],
  social: [
    { id: "s1", label: "LinkedIn", url: "https://linkedin.com/company/acme" },
    { id: "s2", label: "Twitter", url: "https://twitter.com/acme" },
  ],
  overview: "Acme is a fast-growing platform that helps enterprises automate workflows with elegant, intelligent tooling. We're a remote-first team of 280 spread across 14 countries, building the future of work with craft and rigor.",
  mission: "Empower every team to do their best work through thoughtful automation.",
  vision: "A world where ambitious teams ship more and burn out less.",
};

test("an empty or minimally onboarded company never inherits example branding", () => {
  assert.equal(calcProfileStrength(defaultEmployerBrand), 0);
  const brand = hydrateEmployerBrand(company);
  assert.equal(brand.displayName, company.companyName);
  assert.equal(brand.headquarters, company.headquarters);
  assert.equal(brand.companySize, "1-10");
  assert.deepEqual(brand.industries, ["Technology"]);
  for (const field of ["tagline", "website", "overview", "mission", "vision", "foundedYear"] as const) {
    assert.equal(brand[field], "");
  }
  for (const field of ["locations", "social", "values", "gallery", "benefitCategories", "testimonials", "videoTestimonials", "deiStats"] as const) {
    assert.deepEqual(brand[field], []);
  }
  assert.ok(calcProfileStrength(brand) < 20);
  const payload = brandToCompanyPayload(brand);
  assert.deepEqual(payload.industries, ["Technology"]);
  assert.deepEqual(payload.locations, []);
  assert.deepEqual(payload.socialLinks, []);
  assert.equal(payload.tagline, undefined);
  assert.equal(payload.companyWebsite, undefined);
  assert.equal(hydrateEmployerBrand({ ...company, companyName: "New Company" }).displayName, "");
});

test("saving never clears the company name", () => {
  // "New Company" hydrates to a blank display name so the wizard shows an empty
  // field. Sending that back as companyName: "" would erase the stored name, so
  // a blank one is omitted and the server keeps what it has.
  const placeholder = hydrateEmployerBrand({ ...company, companyName: "New Company" });
  assert.equal(brandToCompanyPayload(placeholder).companyName, undefined);
  assert.equal(brandToCompanyPayload({ ...placeholder, displayName: "   " }).companyName, undefined);
  assert.equal(brandToCompanyPayload(defaultEmployerBrand).companyName, undefined);
  // A name the employer actually typed is still sent, trimmed.
  assert.equal(brandToCompanyPayload({ ...placeholder, displayName: "  Airtel Uganda " }).companyName, "Airtel Uganda");
  assert.equal(brandToCompanyPayload(hydrateEmployerBrand(company)).companyName, company.companyName);
});

test("a legacy automatic draft loses untouched examples while keeping real onboarding values", () => {
  const draft = parseEmployerBrandDraft(JSON.stringify(legacyDraft));
  const brand = hydrateEmployerBrand(company, draft);
  assert.equal(brand.displayName, company.companyName);
  assert.equal(brand.headquarters, company.headquarters);
  assert.equal(brand.companySize, "1-10");
  assert.deepEqual(brand.industries, ["Technology"]);
  assert.equal(brand.tagline, "");
  assert.equal(brand.website, "");
  assert.equal(brand.foundedYear, "");
  assert.equal(brand.overview, "");
  assert.deepEqual(brand.locations, []);
  assert.deepEqual(brand.social, []);
  assert.ok(calcProfileStrength(brand) < 20);
});

test("legacy cleanup preserves edited items and explicit deletions instead of deleting the draft", () => {
  const editedLocation = { id: "own-location", city: "Ottawa", country: "Canada" };
  const draft = parseEmployerBrandDraft(JSON.stringify({
    ...legacyDraft,
    tagline: "Our own company tagline", website: "https://qa.example.com", mission: "",
    locations: [...legacyDraft.locations, editedLocation],
    values: [
      { id: "v1", title: "Ship with craft", description: "We obsess over quality and ship work we're proud of." },
      { id: "own-value", title: "Our actual value", description: "Our own description" },
    ],
    gallery: [],
  }));
  const brand = hydrateEmployerBrand({ ...company, mission: "Saved mission", galleryPhotos: [{ url: "https://qa.example.com/team.jpg" }] }, draft);
  assert.equal(brand.tagline, "Our own company tagline");
  assert.equal(brand.website, "https://qa.example.com");
  assert.equal(brand.mission, "");
  assert.deepEqual(brand.locations, [editedLocation]);
  assert.deepEqual(brand.values, [{ id: "own-value", title: "Our actual value", description: "Our own description" }]);
  assert.deepEqual(brand.gallery, []);
});

test("regenerated form row ids do not restore unchanged legacy examples", () => {
  const draft = parseEmployerBrandDraft(JSON.stringify({
    ...legacyDraft,
    locations: legacyDraft.locations.map((location, index) => ({ ...location, id: `form-location-${index}` })),
    social: legacyDraft.social.map((link, index) => ({ ...link, id: `form-link-${index}` })),
  }));
  const brand = hydrateEmployerBrand(company, draft);
  assert.equal(brand.tagline, "");
  assert.deepEqual(brand.locations, []);
  assert.deepEqual(brand.social, []);
});

test("a genuine populated draft retains edits over saved data and inherits unspecified saved fields", () => {
  const draft = {
    tagline: "Draft tagline", website: "https://draft.example.com", industries: ["Design"],
    benefitCategories: [{ id: "own-category", name: "Growth", items: [{ id: "own-perk", label: "Paid mentoring" }] }],
    testimonials: [{ id: "own-review", name: "QA colleague", role: "Designer", quote: "This is a genuine draft review." }],
  };
  const parsed = parseEmployerBrandDraft(JSON.stringify(draft));
  assert.deepEqual(parsed, draft);
  const brand = hydrateEmployerBrand({ ...company, tagline: "Saved tagline", mission: "Saved mission" }, parsed);
  assert.equal(brand.tagline, draft.tagline);
  assert.equal(brand.mission, "Saved mission");
  assert.deepEqual(brand.benefitCategories, draft.benefitCategories);
  assert.deepEqual(JSON.parse(JSON.stringify(brand.testimonials)), draft.testimonials);
  assert.equal(brand.companySize, "1-10");
});

test("all persisted brand sections survive an unedited hydrate/save round trip", () => {
  const saved: EmployerCompany = {
    ...company, tagline: "Saved tagline", companyWebsite: "https://real.example.com", foundedYear: 1998,
    industries: ["Technology", "Design"], overview: "Saved overview", mission: "Saved mission", vision: "Saved vision",
    companyLogo: "https://real.example.com/logo.png", companyBanner: "https://real.example.com/banner.png",
    locations: [{ id: "real-location", city: "Toronto", country: "Canada", isHQ: true }],
    socialLinks: [{ id: "real-social", label: "LinkedIn", url: "https://linkedin.com/company/qa-company" }],
    coreValues: [{ title: "Trust", description: "Real value", icon: "Shield" }],
    galleryPhotos: [{ url: "https://real.example.com/team.jpg", caption: "Real team" }],
    companyBenefits: ["Paid mentoring", "Health coverage"], companyCulture: "Real culture",
    culturePhilosophy: "Real philosophy", cultureCollaboration: "Real collaboration",
    cultureImageUrl: "https://real.example.com/culture.jpg", cultureVideoUrl: "https://real.example.com/culture.mp4",
    whyWorkHere: [{ icon: "Heart", title: "Real reason", description: "Real description" }],
    awards: [{ title: "Real award", organization: "QA Institute", year: "2024" }],
    diversityStatement: "Real statement", deiStats: [{ label: "Real measure", value: "50%" }],
    visibility: "private", showJobs: false, allowFollow: false,
  };
  const payload = brandToCompanyPayload(hydrateEmployerBrand(saved));
  for (const field of [
    "companyName", "tagline", "companyWebsite", "companySize", "foundedYear", "industries", "headquarters",
    "locations", "socialLinks", "overview", "mission", "vision", "companyLogo", "companyBanner", "coreValues",
    "galleryPhotos", "companyBenefits", "companyCulture", "culturePhilosophy", "cultureCollaboration",
    "cultureImageUrl", "cultureVideoUrl", "whyWorkHere", "awards", "diversityStatement", "deiStats",
    "visibility", "showJobs", "allowFollow",
  ] as const) assert.deepEqual(JSON.parse(JSON.stringify(payload[field])), saved[field], field);
  assert.equal(hydrateEmployerBrand({ ...company, companyDescription: "Legacy saved description" }).overview, "Legacy saved description");
});

test("legacy recognition never sanitizes actual server values or intentional v2 drafts", () => {
  const saved = { ...company, tagline: legacyDraft.tagline, companyWebsite: legacyDraft.website, locations: legacyDraft.locations, socialLinks: legacyDraft.social };
  const brand = hydrateEmployerBrand(saved);
  assert.equal(brand.tagline, legacyDraft.tagline);
  assert.deepEqual(brand.locations, legacyDraft.locations);
  const intentional = { ...brand, overview: legacyDraft.overview };
  assert.deepEqual(hydrateEmployerBrand(company, parseEmployerBrandDraft(serializeEmployerBrandDraft(intentional))), intentional);
});

test("malformed stored collections cannot enter the form", () => {
  assert.equal(parseEmployerBrandDraft(JSON.stringify({ version: 2, brand: { testimonials: 4 } })), undefined);
  assert.equal(parseEmployerBrandDraft(JSON.stringify({ industries: [5] })), undefined);
  assert.equal(parseEmployerBrandDraft(JSON.stringify({ benefitCategories: [{ id: "bad", name: "Missing items" }] })), undefined);
  assert.equal(parseEmployerBrandDraft(JSON.stringify(null)), undefined);
});
