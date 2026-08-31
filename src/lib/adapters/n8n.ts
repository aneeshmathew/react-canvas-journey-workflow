import type { Node } from "@xyflow/react";
import type { JourneyDocument, JourneyNodeData, JourneyNodeType } from "@/lib/journeySchema";
import {
  ACTION_DATA_FIELD,
  DEFAULT_CONDITION_BRANCHES,
  ERROR_FALLBACK_HANDLE,
  isActionNodeType,
  isEntryNodeType,
} from "@/lib/journeySchema";

export type N8nNode = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
};

export type N8nConnectionTarget = { node: string; type: "main"; index: number };
export type N8nConnections = Record<string, { main: N8nConnectionTarget[][] }>;

export type N8nWorkflow = {
  name: string;
  nodes: N8nNode[];
  connections: N8nConnections;
  meta: Record<string, unknown>;
};

export type N8nCompileResult = {
  workflow: N8nWorkflow;
  /** Structural limitations of this compiler — surfaced in the publish bundle so they aren't silently hidden. */
  warnings: string[];
};

/**
 * Maps one journey node to its n8n node "shape" (type/version/parameters).
 * This is a best-effort structural scaffold, not a certified n8n importer —
 * see the warnings returned by `journeyToN8nWorkflow` for what a person
 * still needs to configure by hand (credentials, real condition
 * expressions, error-output wiring).
 */
function n8nShapeFor(node: Node<JourneyNodeData>): {
  type: string;
  typeVersion: number;
  parameters: Record<string, unknown>;
} {
  const t = node.type as JourneyNodeType;
  const d = node.data;

  if (isEntryNodeType(t)) {
    if (t === "entry-read-audience") {
      return {
        type: "n8n-nodes-base.scheduleTrigger",
        typeVersion: 1,
        parameters: {
          note: "Read Audience entry — configure your Experience Platform export schedule here.",
          audience: d.segmentHint ?? "",
        },
      };
    }
    // Audience Qualification, Unitary event, Business event are all
    // real-time entry points — modeled as webhook triggers.
    const path = String(d.eventKey ?? d.segmentHint ?? node.id)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    return {
      type: "n8n-nodes-base.webhook",
      typeVersion: 1,
      parameters: {
        path,
        note: "Real-time entry — point your event/audience source at this webhook.",
      },
    };
  }

  if (t === "condition") {
    const branches =
      d.branches && d.branches.length > 0 ? d.branches : [...DEFAULT_CONDITION_BRANCHES];
    return {
      type: "n8n-nodes-base.switch",
      typeVersion: 2,
      parameters: {
        mode: "rules",
        rules: branches.map((b) => ({
          outputKey: b,
          note: "Placeholder — this branch is a name, not an evaluated condition. Configure the real rule in n8n.",
        })),
      },
    };
  }

  if (t === "wait") {
    return {
      type: "n8n-nodes-base.wait",
      typeVersion: 1,
      parameters: { unit: d.waitUnit ?? "days", amount: d.waitAmount ?? 1 },
    };
  }

  if (t === "end") {
    return {
      type: "n8n-nodes-base.noOp",
      typeVersion: 1,
      parameters: { note: "Journey end." },
    };
  }

  // Deprecated "email" literal behaves like action-email — same defensive
  // fallback pattern used elsewhere (see journeySchema.ts).
  if (t === "action-email" || t === "email") {
    return {
      type: "n8n-nodes-base.emailSend",
      typeVersion: 2,
      parameters: {
        subject: d.subject ?? "",
        text: d.templateName ?? "",
        note: "Wire your SMTP/email provider credentials in n8n.",
      },
    };
  }

  if (isActionNodeType(t)) {
    const field = ACTION_DATA_FIELD[t];
    const value = (d[field] as string | undefined) ?? "";
    return {
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4,
      parameters: {
        note: `Call your ${t.replace("action-", "")} provider's API here.`,
        body: value,
      },
    };
  }

  // Legacy mid-journey `audience`/`event` placeholders (predate the
  // entry-point model — see README → Product direction) and anything else
  // unrecognized.
  return {
    type: "n8n-nodes-base.noOp",
    typeVersion: 1,
    parameters: { note: `Unmapped journey node type "${t}" — placeholder only.` },
  };
}

/**
 * Compiles a journey document into an n8n workflow JSON shape. Authoring
 * stays in React; n8n would run the compiled graph headlessly. This
 * replaced the original Phase 0 stub (which always emitted empty
 * nodes/connections) once node types stabilized across Phases 1-3.
 */
export function journeyToN8nWorkflow(journey: JourneyDocument): N8nCompileResult {
  const warnings: string[] = [
    "This is a best-effort structural scaffold, not a verified n8n import — review node types, credentials, and parameters before activating the workflow.",
    "Condition branches map to Switch node outputs by declared order; they are named placeholders, not evaluated rule conditions.",
    "The error/timeout fallback handle is connected as a second output port structurally, but is not wired to n8n's built-in error-output/continueOnFail mechanism.",
  ];

  // n8n keys connections by node *name*, not id — safe here since
  // `journeyValidation.ts` already enforces unique labels across the journey.
  const nameById = new Map(
    journey.nodes.map((n) => [n.id, String(n.data.label ?? n.id)]),
  );

  const nodes: N8nNode[] = journey.nodes.map((n) => {
    const { type, typeVersion, parameters } = n8nShapeFor(n);
    return {
      id: n.id,
      name: nameById.get(n.id)!,
      type,
      typeVersion,
      position: [Math.round(n.position.x), Math.round(n.position.y)],
      parameters,
    };
  });

  const connections: N8nConnections = {};
  for (const n of journey.nodes) {
    const outgoing = journey.edges.filter((e) => e.source === n.id);
    if (outgoing.length === 0) continue;
    const sourceName = nameById.get(n.id)!;
    const outputSlots: N8nConnectionTarget[][] = [];

    if (n.type === "condition") {
      const branches =
        n.data.branches && n.data.branches.length > 0
          ? n.data.branches
          : [...DEFAULT_CONDITION_BRANCHES];
      for (let i = 0; i < branches.length; i += 1) outputSlots.push([]);
      for (const e of outgoing) {
        const idx = branches.indexOf(e.sourceHandle ?? "");
        const targetName = nameById.get(e.target);
        if (idx >= 0 && targetName) {
          outputSlots[idx]!.push({ node: targetName, type: "main", index: 0 });
        }
      }
    } else {
      // Output 0 is the normal flow; output 1 (only present when used) is
      // the error/timeout fallback — see the warning above about this not
      // being wired to n8n's real error-output mechanism yet.
      outputSlots.push([]);
      const hasFallback = outgoing.some(
        (e) => e.sourceHandle === ERROR_FALLBACK_HANDLE,
      );
      if (hasFallback) outputSlots.push([]);
      for (const e of outgoing) {
        const targetName = nameById.get(e.target);
        if (!targetName) continue;
        const idx = e.sourceHandle === ERROR_FALLBACK_HANDLE ? 1 : 0;
        outputSlots[idx]!.push({ node: targetName, type: "main", index: 0 });
      }
    }

    connections[sourceName] = { main: outputSlots };
  }

  return {
    workflow: {
      name: journey.meta?.name ?? "Journey (compiled)",
      nodes,
      connections,
      meta: { template: "journey-to-n8n-compiler-v1" },
    },
    warnings,
  };
}
