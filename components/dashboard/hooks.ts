"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson, type ApiFailure } from "@/lib/api/client";
import type { Paginated } from "@/types/api.types";

const MAX_PER_PAGE = 100;
const MAX_ALL_PAGES = 50;

/** Turns an API failure into a sentence that makes sense to a person. */
export function describeFailure(failure: ApiFailure): string {
  switch (failure.code) {
    case "UNAUTHORIZED":
    case "TOKEN_EXPIRED":
      return "Your session has expired. Log in again to continue.";
    case "RATE_LIMITED":
      return "Too many requests. Wait a moment, then try again.";
    case "INTERNAL_ERROR":
      return failure.status === 0
        ? failure.message
        : "Something went wrong on our side. Please try again.";
    default:
      return failure.message;
  }
}

/** Returns `value` only after it has stopped changing for `delayMs`. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Fetches one page of a list endpoint and keeps it in sync with `url`.
 *
 * Results are tagged with the request key they belong to, so the loading
 * state is derived: while a new key is in flight the previous page stays on
 * screen instead of flashing a skeleton.
 */
export function usePagedList<T>(url: string) {
  const router = useRouter();
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data: Paginated<T> | null;
    error: string | null;
  } | null>(null);

  const key = `${url}#${version}`;

  useEffect(() => {
    let cancelled = false;

    requestJson<Paginated<T>>(url).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok && result.status === 401) {
        router.replace("/login");
      }

      setState((previous) => ({
        key,
        data: result.ok ? result.data : (previous?.data ?? null),
        error: result.ok ? null : describeFailure(result),
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [url, key, router]);

  const reload = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  return {
    data: state?.data ?? null,
    loading: state?.key !== key,
    error: state?.error ?? null,
    reload,
  };
}

/**
 * Loads every item from a paginated endpoint. Used for the lookups the
 * dashboard joins on the client: project titles, tag names, and filter options.
 */
export function useAllItems<T>(path: string) {
  const router = useRouter();
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    key: string;
    items: T[];
    error: string | null;
  } | null>(null);

  const key = `${path}#${version}`;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const collected: T[] = [];
      let page = 1;
      let totalPage = 1;

      do {
        const separator = path.includes("?") ? "&" : "?";
        const result = await requestJson<Paginated<T>>(
          `${path}${separator}page=${page}&perPage=${MAX_PER_PAGE}`,
        );

        if (cancelled) {
          return;
        }

        if (!result.ok) {
          if (result.status === 401) {
            router.replace("/login");
          }

          setState((previous) => ({
            key,
            items: previous?.items ?? [],
            error: describeFailure(result),
          }));
          return;
        }

        collected.push(...result.data.items);
        totalPage = result.data.meta.totalPage;
        page += 1;
      } while (page <= totalPage && page <= MAX_ALL_PAGES);

      setState({ key, items: collected, error: null });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [path, key, router]);

  const reload = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  return {
    items: state?.items ?? [],
    loading: state?.key !== key,
    error: state?.error ?? null,
    reload,
  };
}
