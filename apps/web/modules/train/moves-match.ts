import { MOVE_ROWS } from "./moves-data";

/**
 * Deterministic name → move matching, used when an exercise has no `move` slug (plans written
 * before the move library, manual edits, or a model that left it out).
 *
 * 1. Normalise: lowercase, no accents or punctuation.
 * 2. Translate Spanish gym vocabulary to the library's English words, longest phrase first.
 * 3. Score every move by weighted token overlap (rare words weigh more) and keep the best one
 *    when it is close enough.
 */

/** Spanish phrase → English words. Patterns are normalised; longer patterns win. */
const SPANISH: readonly (readonly [string, string])[] = [
  // Chest
  ["press de banca agarre cerrado", "close grip bench press"],
  ["press de banca cerrado", "close grip bench press"],
  ["press banca cerrado", "close grip bench press"],
  ["press cerrado", "close grip bench press"],
  ["press de banca", "bench press"],
  ["press banca", "bench press"],
  ["press plano", "bench press"],
  ["press de pecho", "chest press"],
  ["press inclinado", "incline press"],
  ["press declinado", "decline press"],
  ["cruce de poleas", "cable fly"],
  ["cruces de poleas", "cable fly"],
  ["cruce de polea", "cable fly"],
  ["aperturas en polea", "cable fly"],
  ["aperturas invertidas", "reverse pec deck"],
  ["contractora inversa", "reverse pec deck"],
  ["contractora", "pec deck"],
  ["estiramiento mariposa", "butterfly stretch"],
  ["estiramiento de mariposa", "butterfly stretch"],
  ["mariposa", "pec deck"],
  ["aperturas", "fly"],
  ["apertura", "fly"],
  ["fondos en banco", "bench dip"],
  ["fondos de banco", "bench dip"],
  ["fondos en silla", "chair dip"],
  ["fondos de pecho", "chest dip"],
  ["fondos lastrados", "weighted dip"],
  ["fondos asistidos", "assisted dip"],
  ["fondos", "dip"],
  ["flexiones diamante", "diamond push up"],
  ["flexiones declinadas", "decline push up"],
  ["flexiones inclinadas", "incline push up"],
  ["flexiones de rodillas", "knee push up"],
  ["flexiones con rodillas", "knee push up"],
  ["flexiones abiertas", "wide push up"],
  ["flexiones en pica", "pike push up"],
  ["flexiones pike", "pike push up"],
  ["flexiones arquero", "archer push up"],
  ["flexiones con palmada", "explosive push up"],
  ["flexiones explosivas", "explosive push up"],
  ["flexiones hindu", "hindu push up"],
  ["flexiones en pared", "wall push up"],
  ["flexiones en pino", "handstand push up"],
  ["flexiones de pino", "handstand push up"],
  ["flexiones con lastre", "weighted push up"],
  ["flexiones", "push up"],
  ["flexion", "push up"],
  ["lagartijas", "push up"],
  // Shoulders
  ["press militar", "overhead press"],
  ["press de hombros", "shoulder press"],
  ["press de hombro", "shoulder press"],
  ["press hombros", "shoulder press"],
  ["press hombro", "shoulder press"],
  ["press arnold", "arnold press"],
  ["press pallof", "pallof press"],
  ["elevaciones laterales", "lateral raise"],
  ["elevacion lateral", "lateral raise"],
  ["elevaciones frontales", "front raise"],
  ["elevacion frontal", "front raise"],
  ["remo al menton", "upright row"],
  ["remo al cuello", "upright row"],
  ["vuelos posteriores", "rear delt fly"],
  ["pajaros", "rear delt fly"],
  ["pajaro", "rear delt fly"],
  ["tiron a la cara", "face pull"],
  ["encogimientos abdominales", "crunch"],
  ["encogimientos inversos", "reverse crunch"],
  ["encogimientos de hombros", "shrug"],
  ["encogimientos", "shrug"],
  ["encogimiento", "shrug"],
  // Back
  ["peso muerto rumano", "romanian deadlift"],
  ["peso muerto piernas rigidas", "romanian deadlift"],
  ["peso muerto sumo", "sumo deadlift"],
  ["peso muerto con barra hexagonal", "trap bar deadlift"],
  ["peso muerto a una pierna", "single leg romanian deadlift"],
  ["peso muerto unilateral", "single leg romanian deadlift"],
  ["peso muerto parcial", "rack pull"],
  ["peso muerto", "deadlift"],
  ["remo inclinado", "bent over row"],
  ["remo con pecho apoyado", "chest supported row"],
  ["remo en polea baja", "seated row"],
  ["remo en polea", "seated row"],
  ["remo sentado", "seated row"],
  ["remo gironda", "seated row"],
  ["remo bajo", "seated row"],
  ["remo en maquina", "machine row"],
  ["remo invertido", "inverted row"],
  ["remo australiano", "inverted row"],
  ["remo en t", "t bar row"],
  ["remo en punta", "t bar row"],
  ["remo pendlay", "pendlay row"],
  ["remo meadows", "meadows row"],
  ["remo con toalla", "towel row"],
  ["maquina de remo", "rowing"],
  ["remo ergometro", "rowing"],
  ["ergometro de remo", "rowing"],
  ["remoergometro", "rowing"],
  ["remar", "rowing"],
  ["remo", "row"],
  ["jalon de triceps", "tricep pushdown"],
  ["jalon triceps", "tricep pushdown"],
  ["jalon con cuerda", "rope tricep pushdown"],
  ["jalon agarre cerrado", "close grip lat pulldown"],
  ["jalon cerrado", "close grip lat pulldown"],
  ["jalon con triangulo", "close grip lat pulldown"],
  ["jalon agarre ancho", "wide grip lat pulldown"],
  ["jalon con brazos rectos", "straight arm pulldown"],
  ["jalon brazos rectos", "straight arm pulldown"],
  ["jalon", "lat pulldown"],
  ["jalones", "lat pulldown"],
  ["pull over", "straight arm pulldown"],
  ["pullover", "straight arm pulldown"],
  ["dominadas supinas", "chin up"],
  ["dominada supina", "chin up"],
  ["dominadas agarre supino", "chin up"],
  ["dominadas asistidas", "assisted pull up"],
  ["dominadas lastradas", "weighted pull up"],
  ["dominadas con lastre", "weighted pull up"],
  ["dominadas agarre neutro", "neutral grip pull up"],
  ["dominadas neutras", "neutral grip pull up"],
  ["dominadas negativas", "negative pull up"],
  ["dominadas", "pull up"],
  ["dominada", "pull up"],
  ["hiperextension inversa", "reverse hyperextension"],
  ["hiperextensiones", "back extension"],
  ["hiperextension", "back extension"],
  ["extensiones lumbares", "back extension"],
  ["extension lumbar", "back extension"],
  ["lumbares", "back extension"],
  ["colgado de la barra", "dead hang"],
  ["colgarse", "dead hang"],
  // Arms
  ["curl martillo con cuerda", "rope hammer curl"],
  ["curl de martillo", "hammer curl"],
  ["curl martillo", "hammer curl"],
  ["martillo en polea", "rope hammer curl"],
  ["martillo", "hammer curl"],
  ["curl predicador", "preacher curl"],
  ["curl en banco scott", "preacher curl"],
  ["curl scott", "preacher curl"],
  ["curl concentrado", "concentration curl"],
  ["curl en banco inclinado", "incline dumbbell curl"],
  ["curl inclinado", "incline dumbbell curl"],
  ["curl arana", "spider curl"],
  ["curl en polea", "cable curl"],
  ["curl invertido", "reverse curl"],
  ["curl inverso", "reverse curl"],
  ["curl de muneca", "wrist curl"],
  ["curl de antebrazo", "wrist curl"],
  ["extension de muneca", "wrist extension"],
  ["curl con barra z", "ez bar curl"],
  ["curl barra z", "ez bar curl"],
  ["curl de arrastre", "drag curl"],
  ["curl femoral tumbado", "lying leg curl"],
  ["curl femoral acostado", "lying leg curl"],
  ["curl femoral sentado", "seated leg curl"],
  ["curl femoral", "leg curl"],
  ["curl de isquios", "leg curl"],
  ["curl de piernas", "leg curl"],
  ["curl nordico", "nordic hamstring curl"],
  ["nordicos", "nordic hamstring curl"],
  ["curl de biceps", "bicep curl"],
  ["curl biceps", "bicep curl"],
  ["extension de triceps en polea", "tricep pushdown"],
  ["triceps en polea", "tricep pushdown"],
  ["triceps polea", "tricep pushdown"],
  ["triceps con cuerda", "rope tricep pushdown"],
  ["extension de triceps", "overhead tricep extension"],
  ["extensiones de triceps", "overhead tricep extension"],
  ["extension triceps", "overhead tricep extension"],
  ["extension tras nuca", "overhead tricep extension"],
  ["patada de triceps", "tricep kickback"],
  ["patadas de triceps", "tricep kickback"],
  ["press frances", "skull crusher"],
  ["rompecraneos", "skull crusher"],
  ["rompe craneos", "skull crusher"],
  // Legs and glutes
  ["sentadilla frontal", "front squat"],
  ["sentadilla bulgara", "bulgarian split squat"],
  ["sentadillas bulgaras", "bulgarian split squat"],
  ["zancada bulgara", "bulgarian split squat"],
  ["bulgaras", "bulgarian split squat"],
  ["sentadilla goblet", "goblet squat"],
  ["sentadilla copa", "goblet squat"],
  ["sentadilla con copa", "goblet squat"],
  ["sentadilla sumo", "sumo squat"],
  ["sentadilla hack", "hack squat"],
  ["sentadilla en multipower", "smith machine squat"],
  ["sentadilla con salto", "jump squat"],
  ["sentadillas con salto", "jump squat"],
  ["sentadilla pistol", "pistol squat"],
  ["sentadilla sissy", "sissy squat"],
  ["sentadilla cosaca", "cossack squat"],
  ["sentadilla isometrica", "wall sit"],
  ["sentadilla en pared", "wall sit"],
  ["silla en pared", "wall sit"],
  ["sentadilla dividida", "split squat"],
  ["sentadilla", "squat"],
  ["sentadillas", "squat"],
  ["gemelos en prensa", "leg press calf raise"],
  ["prensa de piernas", "leg press"],
  ["prensa inclinada", "leg press"],
  ["prensa", "leg press"],
  ["zancadas caminando", "walking lunge"],
  ["zancada caminando", "walking lunge"],
  ["zancadas andando", "walking lunge"],
  ["zancada inversa", "reverse lunge"],
  ["zancadas inversas", "reverse lunge"],
  ["zancada hacia atras", "reverse lunge"],
  ["zancadas hacia atras", "reverse lunge"],
  ["zancada lateral", "lateral lunge"],
  ["zancadas laterales", "lateral lunge"],
  ["zancada cruzada", "curtsy lunge"],
  ["zancadas cruzadas", "curtsy lunge"],
  ["zancadas", "lunge"],
  ["zancada", "lunge"],
  ["estocadas", "lunge"],
  ["estocada", "lunge"],
  ["desplantes", "lunge"],
  ["subidas al cajon", "step up"],
  ["subida al cajon", "step up"],
  ["subidas al banco", "step up"],
  ["bajadas del cajon", "step down"],
  ["extension de cuadriceps", "leg extension"],
  ["extensiones de cuadriceps", "leg extension"],
  ["extension de piernas", "leg extension"],
  ["extensiones de piernas", "leg extension"],
  ["extension de pierna", "leg extension"],
  ["empuje de cadera", "hip thrust"],
  ["empujes de cadera", "hip thrust"],
  ["puente de gluteo a una pierna", "single leg glute bridge"],
  ["puente a una pierna", "single leg glute bridge"],
  ["puente de gluteos", "glute bridge"],
  ["puente de gluteo", "glute bridge"],
  ["puente gluteo", "glute bridge"],
  ["elevacion de cadera", "glute bridge"],
  ["puente", "glute bridge"],
  ["patada de gluteo en polea", "cable kickback"],
  ["patada de gluteo", "glute kickback"],
  ["patadas de gluteo", "glute kickback"],
  ["patada de burro", "donkey kick"],
  ["patadas de burro", "donkey kick"],
  ["boca de incendios", "fire hydrant"],
  ["hidrantes", "fire hydrant"],
  ["almejas", "clamshell"],
  ["almeja", "clamshell"],
  ["abduccion de cadera", "hip abduction"],
  ["maquina de abductores", "hip abduction machine"],
  ["abductores", "hip abduction machine"],
  ["abductor", "hip abduction machine"],
  ["aduccion de cadera", "hip adduction"],
  ["maquina de aductores", "hip adduction machine"],
  ["aductores", "hip adduction machine"],
  ["aductor", "hip adduction machine"],
  ["buenos dias", "good morning"],
  ["elevacion de talones", "calf raise"],
  ["elevaciones de talones", "calf raise"],
  ["elevacion de gemelos", "calf raise"],
  ["elevaciones de gemelos", "calf raise"],
  ["gemelos sentado", "seated calf raise"],
  ["gemelo sentado", "seated calf raise"],
  ["gemelos", "calf raise"],
  ["gemelo", "calf raise"],
  ["paseo del granjero", "farmer carry"],
  ["caminata del granjero", "farmer carry"],
  // Core
  ["plancha con toques de hombro", "plank shoulder tap"],
  ["plancha lateral", "side plank"],
  ["planchas laterales", "side plank"],
  ["plancha", "plank"],
  ["planchas", "plank"],
  ["abdominales en polea", "cable crunch"],
  ["crunch en polea", "cable crunch"],
  ["crunch inverso", "reverse crunch"],
  ["abdominales inversos", "reverse crunch"],
  ["crunch bicicleta", "bicycle crunch"],
  ["bicicleta abdominal", "bicycle crunch"],
  ["abdominales bicicleta", "bicycle crunch"],
  ["abdominales en v", "v up"],
  ["abdominales declinados", "decline sit up"],
  ["abdominales", "crunch"],
  ["abdominal", "crunch"],
  ["elevacion de piernas colgado", "hanging leg raise"],
  ["elevaciones de piernas colgado", "hanging leg raise"],
  ["elevacion de piernas en barra", "hanging leg raise"],
  ["elevacion de rodillas colgado", "hanging knee raise"],
  ["elevaciones de rodillas", "hanging knee raise"],
  ["elevacion de piernas", "lying leg raise"],
  ["elevaciones de piernas", "lying leg raise"],
  ["rueda abdominal", "ab wheel"],
  ["giros rusos", "russian twist"],
  ["giro ruso", "russian twist"],
  ["escaladores", "mountain climber"],
  ["escalador", "mountain climber"],
  ["bicho muerto", "dead bug"],
  ["perro pajaro", "bird dog"],
  ["lenadores", "woodchop"],
  ["lenador", "woodchop"],
  ["inclinaciones laterales", "dumbbell side bend"],
  ["uves", "v up"],
  ["tijeras", "flutter kick"],
  ["caminata de oso", "bear crawl"],
  ["gateo de oso", "bear crawl"],
  ["cangrejo", "crab walk"],
  ["gusano", "inchworm"],
  // Cardio
  ["carrera continua", "running"],
  ["series de carrera", "running"],
  ["cinta inclinada", "treadmill incline walk"],
  ["cinta de correr", "running"],
  ["carrera", "running"],
  ["correr", "running"],
  ["trotar", "running"],
  ["footing", "running"],
  ["rodaje", "running"],
  ["sprints", "running"],
  ["caminata", "walking"],
  ["caminar", "walking"],
  ["andar", "walking"],
  ["paseo", "walking"],
  ["bicicleta estatica", "cycling"],
  ["bici estatica", "cycling"],
  ["bici de aire", "assault bike"],
  ["spinning", "cycling"],
  ["ciclo indoor", "cycling"],
  ["bicicleta", "cycling"],
  ["bici", "cycling"],
  ["ciclismo", "cycling"],
  ["eliptica", "elliptical"],
  ["natacion", "swimming"],
  ["nadar", "swimming"],
  ["piscina", "swimming"],
  ["saltar a la comba", "jump rope"],
  ["saltar la cuerda", "jump rope"],
  ["comba", "jump rope"],
  ["subir escaleras", "stair climber"],
  ["escaladora", "stair climber"],
  ["senderismo", "hiking"],
  ["cuerdas de batalla", "battle ropes"],
  ["saltos de tijera", "jumping jack"],
  ["rodillas al pecho", "high knees"],
  ["skipping", "high knees"],
  ["swing con pesa rusa", "kettlebell swing"],
  ["swing con kettlebell", "kettlebell swing"],
  // Mobility
  ["estiramiento de isquiotibiales", "hamstring stretch"],
  ["estiramiento de isquios", "hamstring stretch"],
  ["estiramiento de cuadriceps", "standing quad stretch"],
  ["estiramiento de pecho", "doorway chest stretch"],
  ["estiramiento de hombro", "cross body shoulder stretch"],
  ["estiramiento de gemelos", "wall calf stretch"],
  ["estiramiento de psoas", "kneeling hip flexor stretch"],
  ["estiramiento de flexores de cadera", "kneeling hip flexor stretch"],
  ["postura del nino", "childs pose"],
  ["gato camello", "cat cow stretch"],
  ["gato vaca", "cat cow stretch"],
  ["circulos de brazos", "arm circles"],
  ["circulos con los brazos", "arm circles"],
  ["balanceos de pierna", "leg swings stretch"],
  ["balanceo de piernas", "leg swings stretch"],
  ["giros de tronco", "torso twist stretch"],
  ["estiramientos", "stretch"],
  ["estiramiento", "stretch"],
  ["movilidad", "stretch"],
  // Equipment and modifiers
  ["barra hexagonal", "trap bar"],
  ["barra z", "ez bar"],
  ["multipower", "smith machine"],
  ["pesa rusa", "kettlebell"],
  ["peso corporal", "bodyweight"],
  ["banda elastica", "band"],
  ["bandas", "band"],
  ["banda", "band"],
  ["gomas", "band"],
  ["goma", "band"],
  ["mancuernas", "dumbbell"],
  ["mancuerna", "dumbbell"],
  ["barra", "barbell"],
  ["poleas", "cable"],
  ["polea", "cable"],
  ["maquina", "machine"],
  ["disco", "plate"],
  ["lastradas", "weighted"],
  ["lastrados", "weighted"],
  ["lastrado", "weighted"],
  ["con lastre", "weighted"],
  ["asistidas", "assisted"],
  ["asistida", "assisted"],
  ["asistido", "assisted"],
  ["inclinado", "incline"],
  ["inclinada", "incline"],
  ["inclinadas", "incline"],
  ["declinado", "decline"],
  ["declinada", "decline"],
  ["agarre cerrado", "close grip"],
  ["agarre ancho", "wide grip"],
  ["agarre neutro", "neutral grip"],
  ["a una mano", "single arm"],
  ["a un brazo", "single arm"],
  ["una mano", "single arm"],
  ["un brazo", "single arm"],
  ["a una pierna", "single leg"],
  ["una pierna", "single leg"],
  ["unilateral", "single"],
  ["sentado", "seated"],
  ["sentada", "seated"],
  ["de pie", "standing"],
  ["tumbado", "lying"],
  ["tumbada", "lying"],
  ["acostado", "lying"],
  ["invertido", "reverse"],
  ["inverso", "reverse"],
  ["inversa", "reverse"],
  ["frontal", "front"],
  ["frontales", "front"],
  ["laterales", "lateral"],
  ["posterior", "rear"],
  ["posteriores", "rear"],
  // Muscles, to break ties between variants
  ["pecho", "chest"],
  ["hombros", "shoulder"],
  ["hombro", "shoulder"],
  ["espalda", "back"],
  ["dorsales", "lat"],
  ["dorsal", "lat"],
  ["antebrazos", "forearm"],
  ["antebrazo", "forearm"],
  ["gluteos", "glute"],
  ["gluteo", "glute"],
  ["cuadriceps", "quad"],
  ["isquiotibiales", "hamstring"],
  ["isquios", "hamstring"],
  ["femoral", "hamstring"],
  ["pantorrillas", "calf"],
  ["piernas", "leg"],
  ["pierna", "leg"],
  ["cadera", "hip"],
  ["trapecios", "upper back"],
  ["trapecio", "upper back"],
];

/** English token clean-up: plurals, abbreviations and spelling variants. */
const ENGLISH: Readonly<Record<string, string>> = {
  presses: "press",
  curls: "curl",
  rows: "row",
  squats: "squat",
  lunges: "lunge",
  raises: "raise",
  dips: "dip",
  flies: "fly",
  flyes: "fly",
  flye: "fly",
  crunches: "crunch",
  extensions: "extension",
  pulldowns: "pulldown",
  pushdowns: "pushdown",
  deadlifts: "deadlift",
  thrusts: "thrust",
  bridges: "bridge",
  kicks: "kick",
  kickbacks: "kickback",
  twists: "twist",
  climbers: "climber",
  jacks: "jack",
  burpees: "burpee",
  shrugs: "shrug",
  swings: "swing",
  crushers: "crusher",
  biceps: "bicep",
  triceps: "tricep",
  glutes: "glute",
  quads: "quad",
  quadriceps: "quad",
  hamstrings: "hamstring",
  calves: "calf",
  lats: "lat",
  delts: "delt",
  deltoids: "delt",
  shoulders: "shoulder",
  legs: "leg",
  hips: "hip",
  forearms: "forearm",
  adductors: "adductor",
  abs: "core",
  abdominals: "core",
  ab: "core",
  one: "single",
  unilateral: "single",
  db: "dumbbell",
  dumbbells: "dumbbell",
  barbells: "barbell",
  kb: "kettlebell",
  kettlebells: "kettlebell",
  bands: "band",
  banded: "band",
  cables: "cable",
  machines: "machine",
  run: "running",
  jog: "running",
  jogging: "running",
  treadmill: "running",
  bike: "cycling",
  spin: "cycling",
  swim: "swimming",
  walk: "walking",
  hike: "hiking",
  stretches: "stretch",
  stretching: "stretch",
};

/** Multi-word English rewrites, applied before tokenising. */
const ENGLISH_PHRASES: readonly (readonly [RegExp, string])[] = [
  [/\b(per|each) (side|arm|leg)\b/g, ""],
  [/\b(pull|push|chin|sit|step|v) ?ups?\b/g, "$1up"],
  [/\bstep ?downs?\b/g, "stepdown"],
  [/\bskull ?crushers?\b/g, "skull crusher"],
  [/\brdl\b/g, "romanian deadlift"],
  [/\bohp\b/g, "overhead press"],
];

/** Equipment words: they confirm or contradict a variant but never make a match on their own. */
const EQUIPMENT_TOKENS = new Set([
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "smith",
  "band",
  "kettlebell",
  "plate",
  "bodyweight",
  "bar",
  "ez",
  "trap",
]);

const STOP = new Set(
  "a al con de del el en la las los lo y o u por para cada lado sobre hacia the with on and of for per each x set sets rep reps serie series repeticiones kg kgs lb lbs min mins minutos s sec secs seg segundos km m metros".split(
    " ",
  ),
);

/** Lowercase, strip accents and punctuation, single spaces. */
export function normaliseName(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SPANISH_RULES = [...SPANISH]
  .sort((a, b) => b[0].split(" ").length - a[0].split(" ").length || b[0].length - a[0].length)
  .map(
    ([pattern, english]) => [new RegExp(`(^| )${pattern}(?= |$)`, "g"), ` ${english} `] as const,
  );

function tokens(text: string, translate: boolean): string[] {
  let value = ` ${normaliseName(text)} `;
  if (translate) for (const [rule, english] of SPANISH_RULES) value = value.replace(rule, english);
  value = value.replace(/\s+/g, " ").trim();
  for (const [rule, replacement] of ENGLISH_PHRASES) value = value.replace(rule, replacement);
  const out: string[] = [];
  for (const raw of value.split(" ")) {
    if (!raw || STOP.has(raw) || /^\d+$/.test(raw)) continue;
    const token = ENGLISH[raw] ?? raw;
    for (const part of token.split(" ")) if (!out.includes(part)) out.push(part);
  }
  return out;
}

const MUSCLE_TOKENS: Readonly<Record<string, readonly string[]>> = {
  chest: ["chest"],
  shoulders: ["shoulder", "delt"],
  "rear-delts": ["rear", "delt", "shoulder"],
  biceps: ["bicep"],
  triceps: ["tricep"],
  forearms: ["forearm"],
  core: ["core"],
  "upper-back": ["back"],
  lats: ["lat", "back"],
  "lower-back": ["back"],
  glutes: ["glute"],
  quads: ["quad", "leg"],
  hamstrings: ["hamstring", "leg"],
  adductors: ["adductor"],
  hips: ["hip"],
  calves: ["calf"],
  cardio: ["cardio"],
  mobility: ["stretch"],
};

/** The equipment a move uses, as a matching token. Unusual props are not worth matching on. */
const EQUIPMENT_TOKEN: Readonly<Record<string, string>> = {
  barbell: "barbell",
  dumbbell: "dumbbell",
  machine: "machine",
  cable: "cable",
  bodyweight: "bodyweight",
  band: "band",
  kettlebell: "kettlebell",
  plate: "plate",
};

interface Entry {
  slug: string;
  /** Movement words from the slug ("incline", "bench", "press"). */
  core: Set<string>;
  /** Equipment the move uses: its equipment field plus equipment words in the slug. */
  equipment: Set<string>;
  /** Equipment words written in the slug ("cable" in cable-crunch): a variant, not the default. */
  variant: Set<string>;
  muscles: Set<string>;
}

const ENTRIES: Entry[] = MOVE_ROWS.map(([slug, , equipment, primary]) => {
  const words = tokens(slug.replaceAll("-", " "), false);
  const core = new Set(words.filter((w) => !EQUIPMENT_TOKENS.has(w)));
  const gear = new Set(words.filter((w) => EQUIPMENT_TOKENS.has(w)));
  const variant = new Set(gear);
  const own = EQUIPMENT_TOKEN[equipment];
  if (own) gear.add(own);
  if (gear.has("smith")) gear.add("machine");
  const muscles = new Set(primary.split(" ").flatMap((group) => MUSCLE_TOKENS[group] ?? []));
  return { slug, core, equipment: gear, variant, muscles };
});

const DF = new Map<string, number>();
for (const entry of ENTRIES) for (const word of entry.core) DF.set(word, (DF.get(word) ?? 0) + 1);
const N = ENTRIES.length;
/** Rare words say more about a move. Words the library never uses ("suave", "cinta") weigh little. */
const weight = (word: string) => {
  const df = DF.get(word);
  return df ? Math.log(1 + N / df) : 1.2;
};

/** Below this score a guess is more likely wrong than helpful. */
const THRESHOLD = 0.5;
/** Equipment the user names is a strong signal; a variant they did not ask for is a tie-breaker. */
const EQUIPMENT_HIT = 2;
const EQUIPMENT_MISS = 2.5;
const VARIANT_EXTRA = 0.2;

function score(query: string[], entry: Entry): number {
  let hit = 0;
  let coreHits = 0;
  let missing = 0;
  for (const word of query) {
    if (EQUIPMENT_TOKENS.has(word)) {
      if (entry.equipment.has(word)) hit += EQUIPMENT_HIT;
      else missing += EQUIPMENT_MISS;
    } else if (entry.core.has(word)) {
      hit += weight(word);
      coreHits += 1;
    } else if (entry.muscles.has(word)) {
      hit += 0.5 * weight(word);
    } else {
      missing += weight(word);
    }
  }
  if (coreHits === 0) return 0;
  let extra = 0;
  for (const word of entry.core) if (!query.includes(word)) extra += 0.6 * weight(word);
  for (const word of entry.variant) if (!query.includes(word)) extra += VARIANT_EXTRA;
  return hit / (hit + missing + extra);
}

const cache = new Map<string, string | undefined>();

/** Slug of the best move for an exercise name, or undefined when nothing is close enough. */
export function matchMoveSlug(name: string): string | undefined {
  const key = normaliseName(name);
  if (cache.has(key)) return cache.get(key);
  const query = tokens(name, true);
  let best: string | undefined;
  let bestScore = THRESHOLD;
  for (const entry of ENTRIES) {
    const s = score(query, entry);
    if (s > bestScore + 1e-9) {
      best = entry.slug;
      bestScore = s;
    }
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, best);
  return best;
}
