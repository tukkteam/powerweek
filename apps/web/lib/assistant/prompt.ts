import {
  systemPrompt,
  userPrompt,
  type ChatMessage,
  type Doc,
  type PromptHost,
} from "@tukkteam/modules";
import { tomorrowOf, type DayKey } from "@tukkteam/modules/week";
import type { Locale } from "@/lib/i18n/config";
import { kernel, MAX_OPERATIONS } from "@/modules";

export type { ChatMessage };

export interface PromptContext {
  lang: Locale;
  todayIso: string;
  todayKey: DayKey;
  doc: Doc;
}

const LANGUAGE: Record<Locale, string> = { es: "Spanish (Spain, informal tú)", en: "English" };
const WEEKDAY_NAME: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

/**
 * What PowerWeek itself tells the model: who it is, the vocabulary every operation shares and
 * the rules that hold whatever modules are involved. Each module adds its own data, operations
 * and rules; the kernel puts it all together.
 */
export function hostPrompt(ctx: Pick<PromptContext, "lang" | "todayKey">): PromptHost {
  return {
    intro:
      "You are the planning assistant inside PowerWeek. You edit ONE recurring weekly plan that repeats every week, Monday to Sunday. Days have no dates.",
    conventions:
      'Day keys are mon, tue, wed, thu, fri, sat, sun. Times are 24h "HH:MM". In the plan json, days with nothing in a module are left out.',
    rules: [
      "Change only what the user asks for. Never invent items, times, amounts or foods they did not mention, unless they ask you to propose meal options.",
      'To change, move or remove something, use its exact "id" from the current plan. If it does not exist, change nothing and say so in "reply".',
      `Expand groups of days into one operation per day: weekdays = mon to fri, weekend = sat and sun, every day = all seven. Today is ${ctx.todayKey}; tomorrow is ${tomorrowOf(ctx.todayKey)}.`,
      'Times: 24h "HH:MM". "7 in the evening" or "7 pm" is "19:00". Without am/pm, use the most natural reading: sports, classes and dinners in the evening; work, breakfast and morning routines in the morning.',
      "Titles are short, in the user's language, sentence case, without a final period. Keep the user's own words for names.",
      'If the request is a question or is not about the plan, return an empty operations list and answer briefly in "reply". When a request is only partly specified, act with sensible defaults and say what you assumed in "reply"; ask (empty operations, reply ending with "?") only when nothing sensible can be done.',
      `"reply" is one short sentence in ${LANGUAGE[ctx.lang]} that says what you did, or asks for the one missing detail. No emoji.`,
      `At most ${MAX_OPERATIONS} operations.`,
      'The screen: the user decides which modules they see and in what order. "Add, show or put the X module" or "I want to organise X" is layout.add; "remove or hide X" or "I do not use X" is layout.remove (everything in it is kept); "X first", "X above Y" or "move X down" is layout.move; a full new order is layout.set. Name modules by their id. Using an operation of a module that is not on screen puts it on screen, so do that only when the request clearly belongs to that module; otherwise use the modules on screen.',
      '"Clear or empty a day" is day.clear and "the same as Monday on Wednesday" is day.copy; both take "modules" to limit them to some modules.',
    ],
  };
}

export function buildMessages(ctx: PromptContext, input: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: systemPrompt(kernel, hostPrompt(ctx), { onScreen: ctx.doc.layout, lang: ctx.lang }),
    },
    {
      role: "user",
      content: userPrompt(kernel, {
        header: `Today is ${WEEKDAY_NAME[ctx.todayKey]} (${ctx.todayKey}), ${ctx.todayIso}.`,
        doc: ctx.doc,
        input,
      }),
    },
  ];
}
