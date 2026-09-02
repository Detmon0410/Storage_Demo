import i18n from "../i18n";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(0, i18n.t("common.connectionError"));
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message = (data && (data.message || data.error)) || i18n.t("common.httpError", { status: res.status });
    throw new ApiError(res.status, message);
  }

  return data as T;
}

export function createResourceApi<T, TCreate = Record<string, unknown>, TUpdate = Record<string, unknown>>(
  resourcePath: string,
) {
  return {
    list: () => request<T[]>(resourcePath),
    get: (id: number) => request<T>(`${resourcePath}/${id}`),
    create: (body: TCreate) =>
      request<T>(resourcePath, { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: TUpdate) =>
      request<T>(`${resourcePath}/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: number) => request<void>(`${resourcePath}/${id}`, { method: "DELETE" }),
  };
}
