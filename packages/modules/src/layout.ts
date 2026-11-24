import { z } from "zod";
import { MAX_LAYOUT } from "./doc";
import { looseInt, opt } from "./fields";
import type { SystemOperationSpec } from "./kernel";
import type { AnyInput, AnyModule } from "./module";

/** A module named by its id ("fuel") or by its name in any language ("Comidas"). */
const reference = z.string().trim().min(1).max(64);
const place = looseInt(1, MAX_LAYOUT);

/**
 * The screen is part of the document: which modules a person sees and in what order. These
 * operations change it, so the screen can be arranged by voice and undone like anything else.
 * Taking a module off the screen never deletes its data.
 */
export function layoutOperations<M extends AnyModule>(): Record<
  string,
  SystemOperationSpec<M, AnyInput>
> {
  const add: SystemOperationSpec<M, { module: string; position?: number }> = {
    input: z.object({ module: reference, position: opt(place) }),
    examples: [{ fields: { module: "<module id>" }, hint: "puts a module on screen" }],
    apply(doc, input, ctx) {
      const module = ctx.find(input.module);
      if (!module) return "not_found";
      if (doc.layout.includes(module.id)) return "noop";
      if (doc.layout.length >= MAX_LAYOUT) return "limit";
      const index = Math.min(doc.layout.length, (input.position ?? doc.layout.length + 1) - 1);
      doc.layout.splice(index, 0, module.id);
      ctx.change({ kind: "add", module: "app", scope: "app", label: module.id });
    },
  };

  const remove: SystemOperationSpec<M, { module: string }> = {
    input: z.object({ module: reference }),
    examples: [
      {
        fields: { module: "<module id>" },
        hint: "takes a module off the screen; everything in it is kept for when it comes back",
      },
    ],
    apply(doc, input, ctx) {
      const module = ctx.find(input.module);
      if (!module) return "not_found";
      if (!doc.layout.includes(module.id)) return "noop";
      doc.layout = doc.layout.filter((id) => id !== module.id);
      ctx.change({ kind: "remove", module: "app", scope: "app", label: module.id });
    },
  };

  const move: SystemOperationSpec<M, { module: string; position: number }> = {
    input: z.object({ module: reference, position: place }),
    examples: [
      {
        fields: { module: "<module id>", position: 1 },
        hint: "moves a module; 1 is the first place",
      },
    ],
    apply(doc, input, ctx) {
      const module = ctx.find(input.module);
      if (!module) return "not_found";
      const from = doc.layout.indexOf(module.id);
      if (from < 0) return "not_found";
      const to = Math.min(doc.layout.length, input.position) - 1;
      if (to === from) return "noop";
      doc.layout.splice(from, 1);
      doc.layout.splice(to, 0, module.id);
      ctx.change({
        kind: "move",
        module: "app",
        scope: "app",
        label: module.id,
        data: { position: to + 1 },
      });
    },
  };

  const set: SystemOperationSpec<M, { modules: string[] }> = {
    input: z.object({ modules: z.array(reference).max(MAX_LAYOUT) }),
    examples: [
      {
        fields: { modules: ["<module id>", "<module id>"] },
        hint: "the screen shows exactly these modules in this order",
        // True of every module a model can name. One this build does not know stays as it is.
      },
    ],
    apply(doc, input, ctx) {
      const wanted: string[] = [];
      for (const name of input.modules) {
        const module = ctx.find(name);
        if (module && !wanted.includes(module.id)) wanted.push(module.id);
      }
      if (input.modules.length > 0 && wanted.length === 0) return "not_found";
      const before = doc.layout;
      // A module on screen that this build does not know cannot be named here, and is not ours
      // to take off: another device may be showing it. It stays right after what came before
      // it, so taking a module off or moving one never moves it on that other screen.
      let anchor: string | null = null;
      for (const id of before) {
        if (ctx.modules.some((module) => module.id === id)) {
          if (wanted.includes(id)) anchor = id;
          continue;
        }
        wanted.splice(anchor === null ? 0 : wanted.indexOf(anchor) + 1, 0, id);
        anchor = id;
      }
      if (wanted.length > MAX_LAYOUT) return "limit";
      if (before.length === wanted.length && before.every((id, i) => id === wanted[i]))
        return "noop";
      for (const id of before) {
        if (!wanted.includes(id))
          ctx.change({ kind: "remove", module: "app", scope: "app", label: id });
      }
      for (const id of wanted) {
        if (!before.includes(id))
          ctx.change({ kind: "add", module: "app", scope: "app", label: id });
      }
      const kept = before.filter((id) => wanted.includes(id));
      const keptAfter = wanted.filter((id) => before.includes(id));
      if (kept.some((id, i) => id !== keptAfter[i]))
        ctx.change({
          kind: "move",
          module: "app",
          scope: "app",
          label: "",
          data: { order: [...wanted] },
        });
      doc.layout = wanted;
    },
  };

  return { "layout.add": add, "layout.remove": remove, "layout.move": move, "layout.set": set };
}
