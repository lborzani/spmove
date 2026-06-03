import { haversineMeters } from '@/services/sptrans';

describe('haversineMeters', () => {
  it('returns 0 for same point', () => {
    expect(haversineMeters(-23.5505, -46.6333, -23.5505, -46.6333)).toBe(0);
  });

  it('calculates ~111km per degree latitude', () => {
    const dist = haversineMeters(0, 0, 1, 0);
    expect(dist).toBeCloseTo(111195, -2);
  });

  it('Paulista to Ibirapuera is ~2.5km', () => {
    const dist = haversineMeters(-23.5614, -46.6559, -23.5874, -46.6576);
    expect(dist).toBeGreaterThan(2000);
    expect(dist).toBeLessThan(4000);
  });

  it('is symmetric', () => {
    const a = haversineMeters(-23.55, -46.63, -23.56, -46.64);
    const b = haversineMeters(-23.56, -46.64, -23.55, -46.63);
    expect(a).toBeCloseTo(b, 0);
  });
});
