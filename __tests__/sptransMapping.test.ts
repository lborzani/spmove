/**
 * Tests for SPTrans API data mapping.
 * buscarLinhas maps tp→lt0, ts→lt1 from /Linha/Buscar response format.
 */

function mapLineResponse(raw: Record<string, unknown>) {
  return { ...raw, lt0: raw.tp, lt1: raw.ts };
}

describe('SPLine mapping (tp→lt0, ts→lt1)', () => {
  const rawLine = {
    cl: 718,
    lc: false,
    lt: '2290',
    sl: 1,
    tl: 10,
    tp: 'TERM. PQ. D. PEDRO II',
    ts: 'TERM. SÃO MATEUS',
  };

  it('maps tp to lt0', () => {
    const mapped = mapLineResponse(rawLine);
    expect(mapped.lt0).toBe('TERM. PQ. D. PEDRO II');
  });

  it('maps ts to lt1', () => {
    const mapped = mapLineResponse(rawLine);
    expect(mapped.lt1).toBe('TERM. SÃO MATEUS');
  });

  it('builds display code from lt and tl', () => {
    const mapped = mapLineResponse(rawLine) as typeof rawLine;
    const code = `${mapped.lt}-${mapped.tl}`;
    expect(code).toBe('2290-10');
  });

  it('preserves original fields', () => {
    const mapped = mapLineResponse(rawLine);
    expect(mapped.cl).toBe(718);
    expect(mapped.sl).toBe(1);
  });
});
