import { BadRequestException } from '@nestjs/common';
import { CATEGORIES, CURRENCIES } from './dto/marketplace.dto';
export type ListingKind = 'service' | 'project';
export type ListingReference = { type: 'service' | 'project' | 'job'; id: string };
export const COMMON_FIELDS = ['title', 'description', 'category', 'skills', 'workMode', 'country', 'city', 'currency', 'publicConsent'];
export const SERVICE_FIELDS = [...COMMON_FIELDS, 'deliverables', 'workSamples', 'availability', 'pricingMode', 'amountMinor'];
export const PROJECT_FIELDS = [...COMMON_FIELDS, 'scope', 'budgetMode', 'minBudgetMinor', 'maxBudgetMinor', 'deadline'];
export function safeWorkUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function normalizedLabels(values: string[]) {
  const seen = new Set<string>();
  return values.map(value => value.trim()).filter(value => {
    const key = value.toLocaleLowerCase('en');
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export function defaults(kind: ListingKind) {
  return {
    title: '', description: '', category: 'design', skills: [], normalizedSkills: [], workMode: 'remote', country: 'Canada', city: null,
    currency: 'CAD', publicConsent: false,
    ...(kind === 'service' ? { deliverables: [], workSamples: [], availability: 'available', pricingMode: 'quote', amountMinor: null }
      : { scope: '', budgetMode: 'negotiable', minBudgetMinor: null, maxBudgetMinor: null, deadline: null }),
  };
}
/** Also enforces bounds when a service is called directly, outside HTTP validation. */
export function validateFields(kind: ListingKind, value: Record<string, any>, publishing = false) {
  const text = (key: string, max: number) => {
    if (typeof value[key] !== 'string' || value[key].length > max) throw new BadRequestException(`${key} exceeds its allowed bounds`);
  };
  text('title', 160); text('description', 10000); text('country', 100);
  if (value.city !== null && value.city !== undefined && (typeof value.city !== 'string' || value.city.length > 100)) throw new BadRequestException('Invalid city');
  if (!CATEGORIES.includes(value.category) || !['remote', 'hybrid', 'onsite'].includes(value.workMode)
    || !Object.prototype.hasOwnProperty.call(CURRENCIES, value.currency) || typeof value.publicConsent !== 'boolean') throw new BadRequestException('Invalid category, mode, currency or consent');
  const labels = (key: string, max: number, length: number) => {
    if (!Array.isArray(value[key]) || value[key].length > max || value[key].some((label: unknown) => typeof label !== 'string' || label.length > length)) throw new BadRequestException(`Invalid ${key}`);
  };
  labels('skills', 20, 60);
  const money = (amount: unknown) => amount === null || amount === undefined || (Number.isSafeInteger(amount) && Number(amount) >= 1 && Number(amount) <= 1000000000);
  if (kind === 'service') {
    labels('deliverables', 12, 300);
    if (!['available', 'limited', 'unavailable'].includes(value.availability) || !['fixed', 'hourly', 'quote'].includes(value.pricingMode) || !money(value.amountMinor)) throw new BadRequestException('Invalid service pricing or availability');
    if (!Array.isArray(value.workSamples) || value.workSamples.length > 8 || value.workSamples.some((sample: any) => !sample || typeof sample.label !== 'string' || sample.label.length > 100 || !safeWorkUrl(sample.url) || Object.keys(sample).some(k => !['label', 'url'].includes(k)))) throw new BadRequestException('Work samples require a label and a credential-free HTTPS URL');
    if (value.pricingMode === 'quote' && value.amountMinor !== null) throw new BadRequestException('Quote pricing must omit an amount');
    if (publishing && (value.pricingMode !== 'quote' && value.amountMinor === null)) throw new BadRequestException('Enter a price in minor units');
    if (publishing && (!value.deliverables.length || value.deliverables.some((label: string) => label.trim().length < 3) || !value.workSamples.length || value.workSamples.some((sample: any) => sample.label.trim().length < 3))) throw new BadRequestException('Add deliverables and relevant work samples before publication');
  } else {
    text('scope', 10000);
    if (!['fixed', 'range', 'negotiable'].includes(value.budgetMode) || !money(value.minBudgetMinor) || !money(value.maxBudgetMinor)) throw new BadRequestException('Invalid project budget');
    const min = value.minBudgetMinor, max = value.maxBudgetMinor;
    if (min !== null && max !== null && min > max) throw new BadRequestException('Minimum budget must not exceed maximum');
    if (value.budgetMode === 'negotiable' && (min !== null || max !== null)) throw new BadRequestException('Negotiable budgets must omit amounts');
    if (value.budgetMode === 'fixed' && min !== null && max !== null && min !== max) throw new BadRequestException('Fixed budgets require matching amounts');
    if (value.deadline !== null && value.deadline !== undefined && (Number.isNaN(new Date(value.deadline).getTime()) || new Date(value.deadline).getTime() > Date.now() + 5 * 366 * 86400000)) throw new BadRequestException('Invalid project deadline');
    if (publishing && ((value.budgetMode !== 'negotiable' && (min === null || max === null)) || value.scope.trim().length < 30 || (value.deadline && new Date(value.deadline) <= new Date()))) throw new BadRequestException('Complete scope, budget and a future deadline before opening');
  }
  if (publishing && (value.title.trim().length < 3 || value.description.trim().length < 30 || !value.skills.some((label: string) => label.trim())
    || value.country.trim().length < 2 || (value.workMode !== 'remote' && (value.city?.trim().length ?? 0) < 2) || !value.publicConsent)) throw new BadRequestException('Complete the listing and consent to public discovery before publication');
}
export function validateTransition(kind: ListingKind, current: string, next: string) {
  const allowed = kind === 'service' ? ['published', 'paused', 'archived'] : ['open', 'paused', 'closed', 'archived'];
  if (!allowed.includes(next) || current === 'archived' || (current === 'draft' && ['paused', 'closed'].includes(next))) throw new BadRequestException('That lifecycle transition is not allowed');
}
