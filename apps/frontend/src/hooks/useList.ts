import { useEffect, useState } from "react";

export function useList<T>(fetcher: () => Promise<T[]>) {
  const [data, setData] = useState<T[]>([]);
  useEffect(() => {
    let active = true;
    fetcher().then((rows) => {
      if (active) setData(rows);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return data;
}
