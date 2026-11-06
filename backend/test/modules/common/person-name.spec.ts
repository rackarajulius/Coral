import { personName } from '../../../src/common/person-name';

describe('What to call someone, shown to other people', () => {
  it('uses their first and last name before any display name', () => {
    expect(personName({ firstName: 'Jane', lastName: 'Smith', displayName: 'jsmith1987' }, 'Someone')).toBe('Jane Smith');
  });

  it('trims, and takes either name alone', () => {
    expect(personName({ firstName: '  Jane ', lastName: '' }, 'Someone')).toBe('Jane');
    expect(personName({ firstName: null, lastName: ' Smith' }, 'Someone')).toBe('Smith');
  });

  it('falls back to the display name, then to what the caller says', () => {
    expect(personName({ firstName: ' ', lastName: null, displayName: ' Janie ' }, 'Someone')).toBe('Janie');
    expect(personName({ displayName: '  ' }, 'Member')).toBe('Member');
    expect(personName(null, 'Someone')).toBe('Someone');
  });
});
