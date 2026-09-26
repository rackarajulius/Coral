// Checks that company seats can only do what their role allows.
//
//   npm run verify:seat-permissions
//
// CompanyCapabilityGuard lets through any route that names no capability, so a
// write route that forgets @RequiresCapability is open to every seat — that is
// how Viewer and Interviewer seats could reject applicants. This reads the real
// controller metadata:
//
// 1. every employer-facing write route in a capability-guarded controller must
//    name a capability, unless it is listed in ALLOWED_WITHOUT_CAPABILITY with
//    a reason;
// 2. the real guard refuses read-only seats on the routes that were open, and
//    lets write seats through.
import 'reflect-metadata';
import { ForbiddenException, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { CompanyMemberStatus, CompanyRole, UserRole } from '@prisma/client';
import { CAPABILITY_KEY, CompanyCapabilityGuard } from '../src/company/company-capability.guard';
import { ROLES_KEY } from '../src/common/decorators/roles.decorator';

import { ApplicationsController } from '../src/applications/applications.controller';
import * as ats from '../src/ats/ats.controller';
import * as automations from '../src/automations/automations.controller';
import * as billing from '../src/billing/billing.controller';
import * as companyAudit from '../src/company/company-audit.controller';
import * as joinLink from '../src/company/company-join-link.controller';
import * as members from '../src/company/company-members.controller';
import * as hiring from '../src/employer-hiring/hiring.controller';
import * as employers from '../src/employers/employers.controller';
import * as slack from '../src/integrations/slack.controller';
import * as webhooks from '../src/integrations/webhooks.controller';
import * as jobs from '../src/jobs/jobs.controller';
import * as messaging from '../src/messaging/messaging.controller';
import * as recommendations from '../src/recommendations/recommendations.controller';
import { OnboardingService } from '../src/employers/onboarding.service';

/**
 * Employer writes that deliberately name no capability, and why. Adding to
 * this list is a decision; the default is that a write needs a capability.
 */
const ALLOWED_WITHOUT_CAPABILITY: Record<string, string> = {
  'HiringController.candidates': 'a search: reads candidates, runs AI ranking, saves nothing',
  'HiringController.copilotRespond': 'a chat reply: reads, saves nothing',
  'HiringController.roleProfile': 'drafts a role profile from a prompt: saves nothing',
  'HiringController.draftOutreach': 'drafts a message; sending it needs messaging:write',
  'HiringController.outreachFromTemplate': 'fills a saved template into a draft; saves nothing, sending needs messaging:write',
  'MessagingController.read': 'marks a thread read for the caller only',
  'MessagingController.assist': 'AI-drafts a reply; saves nothing, sending needs messaging:write',
  'AvailabilityController.add': "the caller's own interview slots — personal by design, interviewers need it",
  'AvailabilityController.remove': "the caller's own interview slots",
  'EmployersController.followCompany': 'a personal follow',
  'EmployersController.unfollowCompany': 'a personal follow',
  'EmployersController.verifyDomain': "verifies the caller's own work-email domain on their own profile",
  'EmployersController.createCompany': "creates the caller's own employer profile; refuses if one exists",
  'EmployersController.saveCompanyStep':
    "onboarding, before any seat exists; renaming an existing company is checked in OnboardingService (company:write)",
  'EmployersController.completeOnboarding': "flips the caller's own account out of onboarding",
};

let fails = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `: ${JSON.stringify(detail)}` : ''}`);
};

type Ctor = new (...args: never[]) => unknown;
const controllers: Ctor[] = [
  ApplicationsController,
  ...[ats, automations, billing, companyAudit, joinLink, members, hiring, employers, slack, webhooks, jobs, messaging, recommendations]
    .flatMap((m) => Object.values(m))
    .filter((v): v is Ctor => typeof v === 'function' && Reflect.hasMetadata(PATH_METADATA, v)),
];

const usesCapabilityGuard = (c: Ctor) =>
  ((Reflect.getMetadata(GUARDS_METADATA, c) ?? []) as unknown[]).includes(CompanyCapabilityGuard);

// 1. Scan
const unguarded: string[] = [];
let scanned = 0;
for (const c of controllers.filter(usesCapabilityGuard)) {
  const classRoles = (Reflect.getMetadata(ROLES_KEY, c) ?? []) as UserRole[];
  for (const key of Object.getOwnPropertyNames(c.prototype)) {
    if (key === 'constructor') continue;
    const handler = (c.prototype as Record<string, unknown>)[key];
    if (typeof handler !== 'function' || !Reflect.hasMetadata(PATH_METADATA, handler)) continue;
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod;
    if (method === RequestMethod.GET || method === RequestMethod.HEAD || method === RequestMethod.OPTIONS) continue;
    const roles = (Reflect.getMetadata(ROLES_KEY, handler) ?? classRoles) as UserRole[];
    // Capabilities describe employer seats; routes only candidates reach are out of scope.
    if (roles.length > 0 && !roles.includes(UserRole.EMPLOYER)) continue;
    scanned++;
    const caps = Reflect.getMetadata(CAPABILITY_KEY, handler) ?? Reflect.getMetadata(CAPABILITY_KEY, c);
    const id = `${c.name}.${key}`;
    if ((!caps || caps.length === 0) && !ALLOWED_WITHOUT_CAPABILITY[id]) {
      unguarded.push(`${id} (${RequestMethod[method]} ${Reflect.getMetadata(PATH_METADATA, c)}/${Reflect.getMetadata(PATH_METADATA, handler)})`);
    }
  }
}
check(`every employer write route names a capability (${scanned} scanned)`, unguarded.length === 0, unguarded);

// 2. The real guard, per seat
const guardFor = (role: CompanyRole) =>
  new CompanyCapabilityGuard(new Reflector(), {
    membershipFor: async () => ({ role, status: CompanyMemberStatus.ACTIVE }),
  } as never);
const contextFor = (c: Ctor, key: string) =>
  ({
    getHandler: () => (c.prototype as Record<string, unknown>)[key],
    getClass: () => c,
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u', role: UserRole.EMPLOYER } }) }),
  }) as never;

/** Seats that may write candidates / the pipeline. */
const CANDIDATE_WRITERS = [CompanyRole.OWNER, CompanyRole.ADMIN, CompanyRole.RECRUITER, CompanyRole.HIRING_MANAGER];
/** Seats that may change the company's public face. */
const COMPANY_EDITORS = [CompanyRole.OWNER, CompanyRole.ADMIN];

/** Routes that were open to every seat before 2026-09-26, and who may use them now. */
const FIXED: [Ctor, string, CompanyRole[]][] = [
  [hiring.HiringController as Ctor, 'createProject', CANDIDATE_WRITERS],
  [hiring.HiringController as Ctor, 'openShortlist', CANDIDATE_WRITERS],
  [hiring.HiringController as Ctor, 'upsertShortlistItem', CANDIDATE_WRITERS],
  [hiring.HiringController as Ctor, 'moveItemToProject', CANDIDATE_WRITERS],
  [hiring.HiringController as Ctor, 'moveShortlistItem', CANDIDATE_WRITERS],
  [hiring.HiringController as Ctor, 'removeShortlistItem', CANDIDATE_WRITERS],
  [hiring.HiringController as Ctor, 'acknowledgeAccommodations', CANDIDATE_WRITERS],
  [ApplicationsController, 'updateStatus', CANDIDATE_WRITERS],
  [employers.EmployersController as Ctor, 'uploadCompanyMedia', COMPANY_EDITORS],
  [webhooks.WebhooksController as Ctor, 'test', COMPANY_EDITORS],
  [messaging.MessagingController as Ctor, 'upload', [...CANDIDATE_WRITERS]],
];

(async () => {
  for (const [c, key, allowed] of FIXED) {
    const outcome: Record<string, string> = {};
    let ok = true;
    for (const role of Object.values(CompanyRole)) {
      let got: string;
      try {
        got = (await guardFor(role).canActivate(contextFor(c, key))) ? 'allowed' : 'denied';
      } catch (e) {
        got = e instanceof ForbiddenException ? 'refused' : `error: ${(e as Error).message}`;
      }
      outcome[role] = got;
      if (got !== (allowed.includes(role) ? 'allowed' : 'refused')) ok = false;
    }
    check(`${c.name}.${key}: only ${allowed.join('/')}`, ok, ok ? undefined : outcome);
  }

  // The company-rename hole in onboarding: a member re-posting the company step.
  const renames: string[] = [];
  const onboardingFor = (role: CompanyRole) =>
    new OnboardingService({
      companyMember: { findFirst: async () => ({ companyId: 'c1', role }) },
      company: { update: async (args: { data: { name: string } }) => renames.push(`${role}:${args.data.name}`) },
    } as never);
  for (const role of Object.values(CompanyRole)) {
    await (onboardingFor(role) as unknown as { createCompanyFor: Function }).createCompanyFor(
      { id: 'u', email: 'x@acme.test' },
      { companyName: `Renamed by ${role}` },
    );
  }
  check(
    'onboarding company step: only Owner/Admin can rename an existing company',
    JSON.stringify(renames.map((r) => r.split(':')[0]).sort()) === JSON.stringify(['ADMIN', 'OWNER']),
    renames,
  );

  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
