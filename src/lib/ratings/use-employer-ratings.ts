import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildEmployerIndex,
  employerKey,
  type RatedEmployer,
  type RatingBundle,
} from "./employer-rating";

let cached: Promise<Map<string, RatedEmployer>> | null = null;

/** Loads every employer's rating once per page load (shared by the feed and the ratings page). */
function loadIndex() {
  cached ??= (async () => {
    const { data, error } = await supabase.rpc("employer_rating_inputs");
    if (error || !data) {
      cached = null; // allow a retry on the next mount
      throw new Error(error?.message ?? "No rating data");
    }
    return buildEmployerIndex(data as unknown as RatingBundle);
  })();
  return cached;
}

export function useEmployerRatings() {
  const [index, setIndex] = useState<Map<string, RatedEmployer> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadIndex()
      .then((i) => live && setIndex(i))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, []);

  return {
    index,
    error,
    lookup: (company: string | null | undefined) =>
      company ? (index?.get(employerKey(company)) ?? null) : null,
  };
}
