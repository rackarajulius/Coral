import { parseQuery } from '../../../src/employer-hiring/search-query';

const strict = (parts: { all?: string[]; any?: string[][]; none?: string[] }) => ({
  all: [], any: [], none: [], ...parts, loose: false,
});

describe('Candidate search query grammar', () => {
  it('keeps a required term out of the OR chain that follows it', () => {
    expect(parseQuery('"product manager" fintech OR payments OR banking')).toEqual(
      strict({ all: ['product manager'], any: [['fintech', 'payments', 'banking']] }),
    );
  });

  it('reads a chain at the start of the query as one group', () => {
    expect(parseQuery('react OR vue OR angular')).toEqual(strict({ any: [['react', 'vue', 'angular']] }));
  });

  it('starts a new group after a chain is ended by another term', () => {
    expect(parseQuery('react OR vue node OR deno')).toEqual(strict({ any: [['react', 'vue'], ['node', 'deno']] }));
    expect(parseQuery('react OR vue AND node OR deno')).toEqual(strict({ any: [['react', 'vue'], ['node', 'deno']] }));
  });

  it('leaves an exclusion before a chain out of the group', () => {
    expect(parseQuery('-agency fintech OR payments OR banking')).toEqual(
      strict({ any: [['fintech', 'payments', 'banking']], none: ['agency'] }),
    );
    expect(parseQuery('NOT agency fintech OR payments OR banking')).toEqual(
      strict({ any: [['fintech', 'payments', 'banking']], none: ['agency'] }),
    );
  });

  it('does not let an OR after an exclusion reach back to an earlier required term', () => {
    expect(parseQuery('remote -agency OR contract')).toEqual(
      strict({ all: ['remote', 'contract'], none: ['agency'] }),
    );
  });

  it('ignores a leading OR and keeps the term after it', () => {
    expect(parseQuery('OR fintech payments')).toEqual(strict({ all: ['fintech', 'payments'] }));
    expect(parseQuery('OR fintech OR payments')).toEqual(strict({ any: [['fintech', 'payments']] }));
  });

  it('ignores a trailing OR', () => {
    expect(parseQuery('fintech OR')).toEqual(strict({ all: ['fintech'] }));
  });

  it('still reads an operator-free query loosely, as one OR group', () => {
    expect(parseQuery('Senior frontend engineer with React and strong system design')).toEqual({
      all: [], any: [['senior', 'frontend', 'engineer', 'react', 'system', 'design']], none: [], loose: true,
    });
    expect(parseQuery('designer or illustrator')).toEqual({
      all: [], any: [['designer', 'illustrator']], none: [], loose: true,
    });
  });
});
