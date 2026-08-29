import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/mockApi";
import type { JourneyDocument } from "@/lib/journeySchema";

export const journeyKeys = {
  all: ["journey"] as const,
  current: () => [...journeyKeys.all, "current"] as const,
};

export const catalogKeys = {
  audiences: ["catalog", "audiences"] as const,
  events: ["catalog", "events"] as const,
  templates: ["catalog", "templates"] as const,
};

/**
 * Loads the authoring journey. Replaces the old synchronous
 * `loadStoredJourneyOrDefault()` call with a proper async query — same
 * underlying storage for now (see `lib/api/mockApi.ts`), but callers get a
 * real loading/error boundary instead of a call that can only "succeed."
 */
export function useJourneyQuery() {
  return useQuery({
    queryKey: journeyKeys.current(),
    queryFn: api.fetchJourney,
    // The canvas (via the Zustand store) owns the source of truth once
    // loaded; we don't want a background refetch clobbering in-progress
    // edits. Saves flow back in through the mutation's onSuccess below.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** Autosave / explicit save, replacing direct `saveToLocalStorage` calls. */
export function useSaveJourneyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (doc: JourneyDocument) => api.saveJourney(doc),
    onSuccess: (saved) => {
      queryClient.setQueryData(journeyKeys.current(), saved);
    },
  });
}

/** Publish action — wraps whatever bundle `lib/publishBundle.ts` builds. */
export function usePublishJourneyMutation() {
  return useMutation({
    mutationFn: (bundle: unknown) => api.publishJourney(bundle),
  });
}

export function useAudiencesQuery() {
  return useQuery({
    queryKey: catalogKeys.audiences,
    queryFn: api.fetchAudiences,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEventsQuery() {
  return useQuery({
    queryKey: catalogKeys.events,
    queryFn: api.fetchEvents,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMessageTemplatesQuery() {
  return useQuery({
    queryKey: catalogKeys.templates,
    queryFn: api.fetchMessageTemplates,
    staleTime: 5 * 60 * 1000,
  });
}
