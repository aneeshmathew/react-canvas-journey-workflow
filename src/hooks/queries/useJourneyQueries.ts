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

// --- Phase 4: Test mode ---------------------------------------------------

export const testModeKeys = {
  profiles: ["test-mode", "profiles"] as const,
  runs: (journeyKey: string, profileId: string) =>
    ["test-mode", "runs", journeyKey, profileId] as const,
};

export function useTestProfilesQuery() {
  return useQuery({
    queryKey: testModeKeys.profiles,
    queryFn: api.fetchTestProfiles,
    staleTime: 5 * 60 * 1000,
  });
}

/** Persisted prior runs for one profile — demonstrates that Test mode profiles are durable, unlike Simulation's ephemeral output. */
export function useTestRunsQuery(profileId: string | null) {
  return useQuery({
    queryKey: testModeKeys.runs(
      api.CURRENT_JOURNEY_KEY,
      profileId ?? "none",
    ),
    queryFn: () => api.fetchTestRuns(api.CURRENT_JOURNEY_KEY, profileId!),
    enabled: profileId !== null,
  });
}

export function useSaveTestRunMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (run: Omit<api.TestRun, "id" | "completedAt">) =>
      api.saveTestRun(run),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({
        queryKey: testModeKeys.runs(saved.journeyKey, saved.profileId),
      });
    },
  });
}
