import { Injectable } from '@nestjs/common';
import { promises as dns } from 'dns';

/** How long a DNS answer may take before the check counts as "not found yet". */
const LOOKUP_TIMEOUT_MS = 5000;

/**
 * The TXT records published on a domain, each as one string.
 *
 * Its own provider so tests can stand in for the internet. A domain with no
 * TXT records, or none at all, answers with an empty list rather than an
 * error: to the person checking, both mean "not there yet".
 */
@Injectable()
export class DomainTxtLookup {
  async records(domain: string): Promise<string[]> {
    let timer: NodeJS.Timeout | undefined;
    try {
      const answer = await Promise.race([
        dns.resolveTxt(domain),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('DNS lookup timed out')), LOOKUP_TIMEOUT_MS);
        }),
      ]);
      // A long TXT record arrives in 255-character chunks.
      return answer.map((chunks) => chunks.join(''));
    } catch {
      return [];
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
