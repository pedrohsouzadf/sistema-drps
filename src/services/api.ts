const API = import.meta.env.VITE_API_URL as string;

const tok = () => localStorage.getItem('access_token') || '';
const hdr = (extra: Record<string, string> = {}) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${tok()}`,
  ...extra,
});

export const apiGet = async <T>(path: string): Promise<T> => {
  const r = await fetch(API + path, { headers: hdr() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

export const apiPost = async <T>(path: string, body?: unknown): Promise<T> => {
  const r = await fetch(API + path, { method: 'POST', headers: hdr(), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

export const apiPut = async <T>(path: string, body: unknown): Promise<T> => {
  const r = await fetch(API + path, { method: 'PUT', headers: hdr(), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

export const apiPatch = async <T>(path: string, body: unknown): Promise<T> => {
  const r = await fetch(API + path, { method: 'PATCH', headers: hdr(), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
};

export const apiDelete = async (path: string, body?: unknown): Promise<void> => {
  const r = await fetch(API + path, {
    method: 'DELETE',
    headers: hdr(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(await r.text());
};
