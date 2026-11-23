import type { Doc } from "./doc";
import type { Kernel, ParsedOperations } from "./kernel";
import type { AnyModule, ModuleId, PromptExample } from "./module";

/**
 * The assistant protocol. A model receives what each module holds and which operations exist,
 * and answers with a JSON object: the operations to apply and one sentence for the person.
 * Everything here is text in and validated operations out; calling a model is the host's job.
 */

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

/** What the host says about itself; the modules say the rest. */
export interface PromptHost {
  /** Who the assistant is and what it edits. */
  intro: string;
  /** Vocabulary every operation shares, such as day keys and the time format. */
  conventions?: string;
  /** Rules that hold for every module. */
  rules: readonly string[];
}

export interface AssistantOutput extends ParsedOperations {
  reply: string;
}

const MAX_REPLY = 400;

/** Run something a module provides; undefined when it throws. */
function attempt<T>(run: () => T): T | undefined {
  try {
    return run();
  } catch {
    return undefined;
  }
}

const line = (name: string, example: PromptExample) =>
  `${JSON.stringify({ op: name, ...example.fields })}${example.hint ? `   ${example.hint}` : ""}`;

/**
 * The system message: what each module is, every operation with an example, and the rules.
 * Long reference texts are only included for modules that are on screen. With `lang`, each
 * module is listed with the name the person sees, so "Comidas" finds its way to "fuel".
 */
export function systemPrompt<M extends AnyModule>(
  kernel: Kernel<M>,
  host: PromptHost,
  options: { onScreen: readonly ModuleId[]; lang?: string },
): string {
  const { onScreen, lang } = options;
  const modules = kernel.modules;
  const about = modules
    .map((module) => {
      const name = lang ? ` (the user calls it "${kernel.messages(module, lang).name}")` : "";
      return `- ${module.id}${name}: ${module.assistant.about}`;
    })
    .join("\n");

  const operations = kernel
    .targets()
    .flatMap((target) => target.spec.examples.map((example) => line(target.name, example)))
    .join("\n");

  const rules = [...host.rules, ...modules.flatMap((module) => module.assistant.rules ?? [])]
    .map((rule, index) => `${index + 1}. ${rule}`)
    .join("\n");

  // A module whose reference throws is left out; the rest of the prompt still works.
  const references = modules
    .filter((module) => onScreen.includes(module.id) && module.assistant.reference)
    .map((module) => attempt(() => module.assistant.reference!()))
    .filter((text): text is string => typeof text === "string" && text.length > 0)
    .join("\n\n");

  return [
    host.intro,
    `The plan is made of modules. Each module keeps one part of it and has its own operations:\n${about}`,
    `You answer with a json object and nothing else: {"operations": [ ... ], "reply": "..."}`,
    `Operations.${host.conventions ? ` ${host.conventions}` : ""}\n${operations}`,
    `Rules:\n${rules}`,
    references,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The user message: what is on screen, the current data of those modules and the request. */
export function userPrompt<M extends AnyModule>(
  kernel: Kernel<M>,
  args: { header?: string; doc: Doc; input: string },
): string {
  const { doc } = args;
  const shown = kernel.onScreen(doc);
  const hidden = kernel.modules.filter((module) => !doc.layout.includes(module.id));
  const broken = kernel.unreadable(doc);
  const plan: Record<string, unknown> = {};
  for (const module of shown) {
    if (broken.has(module.id)) continue;
    const state = kernel.state(doc, module);
    // The data is frozen, so a view cannot change it; one that throws is left out.
    const seen = module.assistant.view ? attempt(() => module.assistant.view!(state)) : state;
    if (seen !== undefined) plan[module.id] = seen;
  }
  const ids = (list: readonly AnyModule[]) => list.map((module) => module.id).join(", ");
  return [
    args.header,
    `Modules on screen, in order: ${ids(shown) || "none"}.${hidden.length ? ` Not on screen: ${ids(hidden)}.` : ""}`,
    `Current plan as json:\n${JSON.stringify(plan)}`,
    `Request from the user: ${JSON.stringify(args.input)}`,
    "Respond with the json object only.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Pull the JSON object out of a model response (tolerates code fences and stray prose). */
export function extractJson(content: string): unknown {
  const text = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Read a model response. Operations are validated one at a time, so one malformed operation
 * never throws away the valid ones next to it. Returns null when there is no usable object.
 */
export function parseOutput<M extends AnyModule>(
  kernel: Kernel<M>,
  content: string,
): AssistantOutput | null {
  const data = extractJson(content);
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as { operations?: unknown; reply?: unknown };
  const raw = Array.isArray(record.operations) ? record.operations : [];
  const reply = typeof record.reply === "string" ? record.reply.trim().slice(0, MAX_REPLY) : "";
  return { ...kernel.parse(raw), reply };
}
