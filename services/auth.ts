export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';
export const BACKEND_KEY = process.env.EXPO_PUBLIC_BACKEND_KEY ?? '';

export const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(BACKEND_KEY ? { 'x-api-key': BACKEND_KEY } : {}),
});
