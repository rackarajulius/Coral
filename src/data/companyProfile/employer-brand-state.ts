import type { EmployerCompany, UpdateEmployerCompanyPayload } from "@/lib/api/employerCompany";
import {
  cleanLegacyEmployerBrandDraft,
  defaultEmployerBrand,
  normalizeEmployerBrand,
  type EmployerBrand,
} from "./employer-brand-schema.ts";

function mergeDefined<T extends object>(base: T, overrides: Partial<T>): T {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

/** All persisted company fields, with honest empty values for absent content. */
export function companyToEmployerBrand(company: EmployerCompany): EmployerBrand {
  const benefits = company.companyBenefits ?? [];
  return normalizeEmployerBrand({
    ...structuredClone(defaultEmployerBrand),
    displayName: company.companyName === "New Company" ? "" : company.companyName,
    tagline: company.tagline ?? "",
    logo: company.companyLogo ?? undefined,
    banner: company.companyBanner ?? undefined,
    website: company.companyWebsite ?? "",
    companySize: company.companySize ?? "",
    foundedYear: company.foundedYear ? String(company.foundedYear) : "",
    industries: company.industries?.length ? company.industries : company.industry ? [company.industry] : [],
    headquarters: company.headquarters ?? "",
    locations: company.locations ?? [],
    social: company.socialLinks ?? [],
    overview: company.overview ?? company.companyDescription ?? "",
    mission: company.mission ?? "",
    vision: company.vision ?? "",
    values: (company.coreValues ?? []).map((value, index) => ({ id: `saved-value-${index}`, ...value })),
    gallery: (company.galleryPhotos ?? []).map((photo, index) => ({ ...photo, id: photo.id ?? `saved-photo-${index}` })),
    cultureVideo: company.cultureVideoUrl ?? "",
    cultureDescription: company.companyCulture ?? "",
    culturePhilosophy: company.culturePhilosophy ?? "",
    cultureCollaboration: company.cultureCollaboration ?? "",
    cultureImage: company.cultureImageUrl ?? "",
    benefits: benefits.map((label, index) => ({ id: `saved-benefit-${index}`, label, category: "Benefits" })),
    benefitCategories: benefits.length ? [{
      id: "saved-benefits", name: "Benefits", expanded: true,
      items: benefits.map((label, index) => ({ id: `saved-benefit-${index}`, label })),
    }] : [],
    whyWorkHere: (company.whyWorkHere ?? []).map((card, index) => ({
      ...card, id: card.id ?? `saved-reason-${index}`, icon: card.icon ?? "", description: card.description ?? "",
    })),
    awards: (company.awards ?? []).map((award, index) => ({ ...award, id: award.id ?? `saved-award-${index}` })),
    diversityStatement: company.diversityStatement ?? "",
    deiStats: (company.deiStats ?? []).map((stat, index) => ({ ...stat, id: stat.id ?? `saved-stat-${index}` })),
    visibility: company.visibility,
    showJobs: company.showJobs,
    allowFollow: company.allowFollow,
  });
}

/** Draft fields belong over server values; missing draft fields inherit the server. */
export function hydrateEmployerBrand(company?: EmployerCompany | null, draft?: Partial<EmployerBrand>): EmployerBrand {
  const base = company ? companyToEmployerBrand(company) : structuredClone(defaultEmployerBrand);
  return normalizeEmployerBrand(mergeDefined(base, draft ?? {}));
}

/** A version distinguishes future intentional content from old automatic examples. */
export function serializeEmployerBrandDraft(brand: EmployerBrand): string {
  return JSON.stringify({ version: 2, brand });
}

function validDraftRows(field: string, rows: unknown[]): boolean {
  const required: Record<string, string[]> = {
    locations: ["id", "city", "country"], social: ["id", "label", "url"], values: ["id", "title"],
    gallery: ["id", "url"], whyWorkHere: ["id", "icon", "title", "description"],
    benefits: ["id", "label", "category"], benefitCategories: ["id", "name"],
    testimonials: ["id", "name", "role", "quote"], videoTestimonials: ["id", "name", "role"],
    awards: ["id", "title", "organization", "year"], deiStats: ["id", "label", "value"],
  };
  return rows.every((row) => {
    if (field === "industries") return typeof row === "string";
    if (!row || typeof row !== "object" || Array.isArray(row)) return false;
    const item = row as Record<string, unknown>;
    if ((required[field] ?? []).some((key) => typeof item[key] !== "string")) return false;
    for (const key of ["avatar", "videoUrl", "thumbnail", "description", "caption", "icon", "badgeUrl"]) {
      if (item[key] !== undefined && typeof item[key] !== "string") return false;
    }
    return field !== "benefitCategories" || (Array.isArray(item.items) && item.items.every((benefit) => (
      benefit && typeof benefit === "object" && typeof benefit.id === "string" && typeof benefit.label === "string"
    )));
  });
}

export function parseEmployerBrandDraft(serialized: string | null): Partial<EmployerBrand> | undefined {
  if (!serialized) return undefined;
  const parsed = JSON.parse(serialized);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const candidate = parsed.version === 2 ? parsed.brand : parsed;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return undefined;
  const draft: Partial<EmployerBrand> = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (!Object.prototype.hasOwnProperty.call(defaultEmployerBrand, key)) continue;
    const empty = defaultEmployerBrand[key as keyof EmployerBrand];
    if (Array.isArray(empty)) {
      if (!Array.isArray(value) || !validDraftRows(key, value)) return undefined;
    } else if (value !== undefined && typeof value !== (typeof empty === "boolean" ? "boolean" : "string")) {
      return undefined;
    }
    (draft as Record<string, unknown>)[key] = value;
  }
  return parsed.version === 2 ? draft : cleanLegacyEmployerBrandDraft(draft);
}

function isStoredUrl(url?: string): url is string {
  return !!url && !url.startsWith("data:") && !url.startsWith("blob:");
}

/** The wizard's editable persisted fields; locally reviewed testimonials stay local. */
export function brandToCompanyPayload(brand: EmployerBrand): UpdateEmployerCompanyPayload {
  const foundedYear = parseInt(brand.foundedYear, 10);
  return {
    companyName: brand.displayName,
    tagline: brand.tagline || undefined,
    companyLogo: brand.logo || undefined,
    companyBanner: brand.banner || undefined,
    companyWebsite: brand.website || undefined,
    companySize: brand.companySize || undefined,
    foundedYear: Number.isFinite(foundedYear) ? foundedYear : undefined,
    industries: brand.industries,
    headquarters: brand.headquarters || undefined,
    locations: brand.locations as unknown as UpdateEmployerCompanyPayload["locations"],
    socialLinks: brand.social as unknown as UpdateEmployerCompanyPayload["socialLinks"],
    overview: brand.overview || undefined,
    mission: brand.mission || undefined,
    vision: brand.vision || undefined,
    coreValues: brand.values.filter((value) => value.title.trim()).map((value) => ({
      title: value.title.trim(), description: value.description?.trim() || undefined, icon: value.icon || undefined,
    })),
    galleryPhotos: brand.gallery.filter((photo) => isStoredUrl(photo.url)).map((photo) => ({
      url: photo.url, caption: photo.caption || undefined,
    })),
    cultureVideoUrl: isStoredUrl(brand.cultureVideo) ? brand.cultureVideo : undefined,
    companyCulture: brand.cultureDescription || undefined,
    culturePhilosophy: brand.culturePhilosophy || undefined,
    cultureCollaboration: brand.cultureCollaboration || undefined,
    cultureImageUrl: isStoredUrl(brand.cultureImage) ? brand.cultureImage : undefined,
    companyBenefits: brand.benefitCategories.flatMap((category) => category.items.map((item) => item.label.trim())).filter(Boolean),
    whyWorkHere: brand.whyWorkHere.filter((card) => card.title.trim()).map((card) => ({
      icon: card.icon || undefined, title: card.title.trim(), description: card.description?.trim() || undefined,
    })),
    awards: brand.awards.filter((award) => award.title.trim() && award.organization.trim()).map((award) => ({
      title: award.title.trim(), organization: award.organization.trim(), year: award.year.trim(),
      description: award.description?.trim() || undefined, badgeUrl: award.badgeUrl || undefined,
    })),
    diversityStatement: brand.diversityStatement || undefined,
    deiStats: brand.deiStats.filter((stat) => stat.label.trim() && stat.value.trim()).map((stat) => ({ label: stat.label.trim(), value: stat.value.trim() })),
    visibility: brand.visibility,
    showJobs: brand.showJobs,
    allowFollow: brand.allowFollow,
  };
}
