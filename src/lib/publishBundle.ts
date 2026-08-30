import { journeyToN8nWorkflow, type N8nWorkflow } from "@/lib/adapters/n8n";
import type { JourneyDocument } from "@/lib/journeySchema";

export const PUBLISH_BUNDLE_VERSION = 1 as const;

export type PublishBundle = {
  bundleVersion: typeof PUBLISH_BUNDLE_VERSION;
  publishedAt: string;
  journey: JourneyDocument;
  n8nWorkflow: N8nWorkflow;
  /** Structural limitations of the compiler — see `lib/adapters/n8n.ts`. Surfaced here so a downloaded bundle documents its own caveats. */
  compilerWarnings: string[];
};

export function buildPublishBundle(journey: JourneyDocument): PublishBundle {
  const { workflow, warnings } = journeyToN8nWorkflow(journey);
  return {
    bundleVersion: PUBLISH_BUNDLE_VERSION,
    publishedAt: new Date().toISOString(),
    journey,
    n8nWorkflow: workflow,
    compilerWarnings: warnings,
  };
}

export function serializePublishBundle(bundle: PublishBundle): string {
  return JSON.stringify(bundle, null, 2);
}
