import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import i18n from "../i18n";

interface ResourceApi<T, TCreate, TUpdate> {
  list: () => Promise<T[]>;
  create: (body: TCreate) => Promise<T>;
  update: (id: number, body: TUpdate) => Promise<T>;
  remove: (id: number) => Promise<void>;
}

export function useResource<T, TCreate = Record<string, unknown>, TUpdate = Record<string, unknown>>(
  api: ResourceApi<T, TCreate, TUpdate>,
  getId: (row: T) => number,
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.list();
      setRows(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : i18n.t("common.httpError", { status: "?" }));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (body: TCreate) => {
      setSaving(true);
      try {
        const created = await api.create(body);
        setRows((prev) => [...prev, created]);
        return created;
      } finally {
        setSaving(false);
      }
    },
    [api],
  );

  const update = useCallback(
    async (id: number, body: TUpdate) => {
      setSaving(true);
      try {
        const updated = await api.update(id, body);
        setRows((prev) => prev.map((row) => (getId(row) === id ? updated : row)));
        return updated;
      } finally {
        setSaving(false);
      }
    },
    [api, getId],
  );

  const remove = useCallback(
    async (id: number) => {
      setSaving(true);
      try {
        await api.remove(id);
        setRows((prev) => prev.filter((row) => getId(row) !== id));
      } finally {
        setSaving(false);
      }
    },
    [api, getId],
  );

  return { rows, loading, error, saving, reload: load, create, update, remove, setRows };
}
