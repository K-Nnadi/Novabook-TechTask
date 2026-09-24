import { dateToEpoch, isIsoDateTime } from '../src/api/common/iso-date';
import { eventFallsOnOrBefore } from '../src/api/modules/orchestration/taxPosition/utils/tax-event';

describe('isIsoDateTime', () => {
  it.each([
    '2024-02-22T17:29:39Z',
    '2024-02-22T17:29:39.123Z',
    '2024-02-22T17:29:39+01:00',
    '2024-02-22T17:29:39-05:00',
  ])('accepts %s', (value) => {
    expect(isIsoDateTime(value)).toBe(true);
  });

  it.each([
    '',
    'not-a-date',
    '2024-02-22',
    '2024-02-22T17:29:39',
    '2024-13-22T17:29:39Z',
    1710000000000,
    null,
  ])('rejects %s', (value) => {
    expect(isIsoDateTime(value)).toBe(false);
  });
});

describe('dateToEpoch', () => {
  it('parses 2024-02-22T17:29:39Z as 1708622979000', () => {
    expect(dateToEpoch('2024-02-22T17:29:39Z')).toBe(1708622979000);
  });
});

describe('eventFallsOnOrBefore', () => {
  const query = '2024-02-22T17:29:39Z';

  it('includes the query instant itself', () => {
    expect(eventFallsOnOrBefore(query, query)).toBe(true);
  });

  it('includes an earlier instant', () => {
    expect(eventFallsOnOrBefore('2024-02-22T17:29:38Z', query)).toBe(true);
  });

  it('excludes a later instant', () => {
    expect(eventFallsOnOrBefore('2024-02-22T17:29:40Z', query)).toBe(false);
  });
});
