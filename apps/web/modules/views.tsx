"use client";

import { views as agenda } from "./agenda/views";
import { views as fuel } from "./fuel/views";
import type { AnyViews } from "./host";
import { views as notes } from "./notes/views";
import { views as train } from "./train/views";

/**
 * How each module draws itself, by module id. The data side of the registry is in `index.ts`;
 * a module listed there without views here still works by voice but has nothing to show.
 */
const VIEWS: Record<string, AnyViews> = { agenda, fuel, train, notes };

/** The views of a module, or undefined when it has none. */
export const viewsOf = (id: string): AnyViews | undefined =>
  Object.hasOwn(VIEWS, id) ? VIEWS[id] : undefined;
