export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  options: { body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.body === undefined ? 'GET' : 'POST',
    headers: {
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    ...(options.signal ? { signal: options.signal } : {}),
  });
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    issues?: { message: string; path: (string | number)[] }[];
  } | null;
  if (!response.ok) {
    const detail = payload?.issues?.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ApiError(
      detail || payload?.error || `Request failed (${response.status})`,
      response.status,
    );
  }
  return payload as T;
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request could not be completed.';
}
