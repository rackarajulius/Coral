import { CompanyJoinLinkService } from '../../../src/company/company-join-link.service';
import { companyDomainOf, signInDomainOf } from '../../../src/company/company-domain.service';
import { DomainTxtLookup } from '../../../src/company/domain-txt-lookup';

const admission = (CompanyJoinLinkService.prototype as unknown as {
  decideAdmission(locked: boolean, domain: string | null, user: { email: string; emailVerified: boolean }): { status: string; pendingReason: string | null };
}).decideAdmission;

describe('What counts as a company domain', () => {
  it.each([
    ['https://www.Airtel.co.ug/careers', 'airtel.co.ug'],
    ['airtel.co.ug', 'airtel.co.ug'],
    ['hr@Airtel.co.ug', 'airtel.co.ug'],
    ['mtn.co.ug.', 'mtn.co.ug'],
  ])('reads %j as %j', (input, expected) => expect(companyDomainOf(input)).toBe(expected));

  it.each(['gmail.com', 'someone@gmail.com', 'https://outlook.com', 'localhost', 'not a domain', '', null])(
    'refuses %j: not a domain one company could own', (input) => expect(companyDomainOf(input)).toBeNull());

  it('proves a domain by sign-in only once the address is confirmed', () => {
    expect(signInDomainOf({ email: 'hr@airtel.co.ug', emailVerified: true })).toBe('airtel.co.ug');
    expect(signInDomainOf({ email: 'hr@airtel.co.ug', emailVerified: false })).toBeNull();
    expect(signInDomainOf({ email: 'me@gmail.com', emailVerified: true })).toBeNull();
  });
});

describe('The join link admits on a proven domain and a confirmed address only', () => {
  const at = (emailVerified: boolean) => ({ email: 'new@airtel.co.ug', emailVerified });
  it('lets a confirmed colleague straight in', () => expect(admission(true, 'airtel.co.ug', at(true)).status).toBe('ACTIVE'));
  it('holds an unconfirmed address for approval, and says why', () => {
    expect(admission(true, 'airtel.co.ug', at(false))).toEqual({ status: 'PENDING', pendingReason: expect.stringMatching(/isn't confirmed/) });
  });
  it('holds everyone for approval when the company has proven no domain', () => {
    expect(admission(true, null, at(true))).toEqual({ status: 'PENDING', pendingReason: expect.stringMatching(/hasn't proven a domain/) });
  });
  it('holds someone at another domain', () => expect(admission(true, 'airtel.co.ug', { email: 'x@mtn.co.ug', emailVerified: true }).status).toBe('PENDING'));
});

describe('Reading TXT records', () => {
  it('joins a long record split into chunks, and treats no answer as no records', async () => {
    const dns = jest.requireActual('dns');
    const spy = jest.spyOn(dns.promises, 'resolveTxt')
      .mockResolvedValueOnce([['coral-verification=', 'abc'], ['v=spf1 -all']])
      .mockRejectedValueOnce(Object.assign(new Error('nope'), { code: 'ENOTFOUND' }));
    const lookup = new DomainTxtLookup();
    await expect(lookup.records('a.example')).resolves.toEqual(['coral-verification=abc', 'v=spf1 -all']);
    await expect(lookup.records('b.example')).resolves.toEqual([]);
    spy.mockRestore();
  });
});
