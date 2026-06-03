import { getGtfsShape, gtfsLoaded } from '@/services/gtfs';

describe('getGtfsShape', () => {
  it('returns null when shapes file is empty', () => {
    expect(gtfsLoaded()).toBe(false);
    expect(getGtfsShape('702C-10')).toBeNull();
  });

  it('returns null for unknown line', () => {
    expect(getGtfsShape('LINHA-INEXISTENTE')).toBeNull();
  });
});

describe('normalize (via getGtfsShape)', () => {
  it('handles hyphen in line code', () => {
    const result = getGtfsShape('702C-10');
    expect(result).toBeNull(); // null because file is empty, but no crash
  });

  it('handles lowercase input without crash', () => {
    expect(() => getGtfsShape('702c-10')).not.toThrow();
  });

  it('handles empty string without crash', () => {
    expect(() => getGtfsShape('')).not.toThrow();
  });
});
