// DTO decorators need this before any of them load.
import 'reflect-metadata';
import { WORK_CATEGORIES, WORK_CATEGORY_VALUES } from '../../../src/common/work-categories';
import { PROVIDER_CATEGORIES, providerProfileReadiness } from '../../../src/freelancers/provider-profile-policy';
import { CATEGORIES } from '../../../src/marketplace/dto/marketplace.dto';
import { FreelancersController } from '../../../src/freelancers/freelancers.controller';
import { FreelancersService } from '../../../src/freelancers/freelancers.service';
import { AppValidationPipe } from '../../../src/common/pipes/validation.pipe';
import { UpdateFreelancerProfileDto } from '../../../src/freelancers/dto/update-freelancer-profile.dto';
import { BadRequestException } from '@nestjs/common';

const ready = (category: string) => ({
  providerEnabled: true, publicPreviewEnabled: true, category,
  headline: 'Professional', summary: 'An introduction long enough to publish on Coral.',
  skills: ['Skill'], portfolioUrl: 'https://example.com/work', githubUrl: null,
});

describe('The kinds of work on Coral', () => {
  it('is one list for providers, services and project briefs', () => {
    expect(PROVIDER_CATEGORIES).toBe(WORK_CATEGORY_VALUES);
    expect(CATEGORIES).toBe(WORK_CATEGORY_VALUES);
    expect(WORK_CATEGORY_VALUES).toEqual(WORK_CATEGORIES.map((c) => c.value));
  });

  it('opens beyond the first three, and keeps them', () => {
    expect(WORK_CATEGORY_VALUES).toHaveLength(12);
    expect(WORK_CATEGORY_VALUES).toEqual(expect.arrayContaining(['design', 'marketing', 'software']));
    expect(new Set(WORK_CATEGORY_VALUES).size).toBe(WORK_CATEGORY_VALUES.length);
    for (const { label } of WORK_CATEGORIES) expect(label.trim()).toBe(label);
  });

  it('lets a profile in any category be public', () => {
    for (const value of WORK_CATEGORY_VALUES) expect(providerProfileReadiness(ready(value))).toEqual({ ready: true, missingFields: [] });
  });

  it.each(['legal', 'accounting', 'engineering', 'health'])('leaves out the regulated profession %s, which needs a licence Coral cannot check', async (value) => {
    expect(WORK_CATEGORY_VALUES).not.toContain(value);
    expect(providerProfileReadiness(ready(value)).missingFields).toContain('category');
    await expect(new AppValidationPipe().transform({ category: value }, { type: 'body', metatype: UpdateFreelancerProfileDto }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('serves the list, labels included, to the web app', () => {
    const controller = new FreelancersController({} as FreelancersService);
    expect(controller.listCategories()).toEqual({ success: true, data: WORK_CATEGORIES });
  });
});
