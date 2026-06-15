const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';
const BACKEND_KEY = process.env.EXPO_PUBLIC_BACKEND_KEY ?? '';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(BACKEND_KEY ? { 'x-api-key': BACKEND_KEY } : {}),
});

export type ReportCategory = 'atraso' | 'superlotacao' | 'acidente' | 'outro';

export interface UserReport {
  id: number;
  line_num: string;
  category: ReportCategory;
  station: string | null;
  description: string | null;
  image_b64: string | null;
  net_votes: number;
  promoted: number;
  created_at: number;
  expires_at: number;
  my_vote: 1 | -1 | null;
}

export async function fetchReports(lineNum: string, deviceId: string): Promise<UserReport[]> {
  const res = await fetch(
    `${BACKEND_URL}/api/reports?line=${encodeURIComponent(lineNum)}&deviceId=${encodeURIComponent(deviceId)}`,
    { headers: authHeaders() },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { reports: UserReport[] };
  return data.reports;
}

export async function fetchReportsSummary(): Promise<Record<string, number>> {
  const res = await fetch(`${BACKEND_URL}/api/reports/summary`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { summary: Record<string, number> };
  return data.summary;
}

export async function createReport(params: {
  deviceId: string;
  lineNum: string;
  category: ReportCategory;
  station?: string;
  description?: string;
  imageB64?: string;
}): Promise<UserReport> {
  const res = await fetch(`${BACKEND_URL}/api/reports`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      deviceId: params.deviceId,
      lineNum: params.lineNum,
      category: params.category,
      station: params.station ?? null,
      description: params.description ?? null,
      imageB64: params.imageB64 ?? null,
    }),
  });
  const body = (await res.json()) as { report?: UserReport; error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.report!;
}

export async function voteReport(
  reportId: number,
  vote: 1 | -1,
  deviceId: string,
): Promise<{ netVotes: number; promoted: boolean }> {
  const res = await fetch(`${BACKEND_URL}/api/reports/${reportId}/vote`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ deviceId, vote }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ netVotes: number; promoted: boolean }>;
}
