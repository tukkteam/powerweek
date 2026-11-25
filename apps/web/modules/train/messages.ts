import type { ModuleMessages } from "@tukkteam/modules";
import type { Locale } from "@/lib/i18n/config";
import { plural } from "@/lib/i18n/plural";
import type { Equipment, MuscleGroup } from "./moves";

export interface TrainMessages extends ModuleMessages {
  empty: string;
  /** Title of a workout created by adding a single exercise. */
  defaultTitle: string;
  exercises: (n: number) => string;
  workouts: (n: number) => string;
  sets: (n: number) => string;
  minutes: (n: number) => string;
  done: string;
  markDone: string;
  markUndone: string;
  works: (list: string) => string;
  musclesLabel: (list: string) => string;
  primary: string;
  secondary: string;
  equipmentLabel: string;
  sequence: string;
  phase: (n: number) => string;
  openExercise: (name: string) => string;
  noArt: string;
  /** Credit for the drawn frames, shown only when a move falls back to them (deprecated). */
  credit: string;
  /** Credit for the catalogue a move comes from (names, equipment, muscles). */
  source: string;
  and: string;
  editor: {
    newExercise: string;
    editExercise: string;
    workoutTitle: string;
    renameWorkout: string;
    editWorkout: string;
    workoutTime: string;
    removeWorkout: string;
    exercise: string;
    sets: string;
    reps: string;
    load: string;
    loadPlaceholder: string;
  };
  muscles: Record<MuscleGroup, string>;
  equipment: Record<Equipment, string>;
}

export const messages: Record<Locale, TrainMessages> = {
  es: {
    name: "Entreno",
    description:
      "Tu rutina de cada día con series, repeticiones y peso, dibujada ejercicio a ejercicio.",
    example: "El viernes empuje: press banca 4 × 8",
    empty: "Sin entreno. Prueba: «los lunes hago pierna: sentadilla 5 × 5».",
    defaultTitle: "Entrenamiento",
    exercises: (n) => plural(n, "1 ejercicio", "# ejercicios"),
    workouts: (n) => plural(n, "1 entreno", "# entrenos"),
    sets: (n) => plural(n, "1 serie", "# series"),
    minutes: (n) => `≈ ${n} min`,
    done: "Entreno hecho",
    markDone: "Marcar entreno como hecho",
    markUndone: "Desmarcar entreno",
    works: (list) => `Trabaja ${list}`,
    musclesLabel: (list) => `Músculos que trabaja: ${list}`,
    primary: "Principal",
    secondary: "También trabaja",
    equipmentLabel: "Material",
    sequence: "Secuencia del movimiento",
    phase: (n) => `Fase ${n}`,
    openExercise: (name) => `Ver «${name}»`,
    noArt: "Sin dibujo",
    credit: "Ilustración: Workout Guide (Bryl Lim), basada en Everkinetic · CC BY-SA 4.0",
    source: "Datos del ejercicio: Workout Guide (Bryl Lim) · MIT",
    and: " y ",
    editor: {
      newExercise: "Nuevo ejercicio",
      editExercise: "Editar ejercicio",
      workoutTitle: "Nombre del entreno",
      renameWorkout: "Renombrar entreno",
      editWorkout: "Editar entreno",
      workoutTime: "Hora",
      removeWorkout: "Quitar entreno",
      exercise: "Ejercicio",
      sets: "Series",
      reps: "Repeticiones",
      load: "Carga",
      loadPlaceholder: "80 kg",
    },
    muscles: {
      chest: "Pecho",
      shoulders: "Hombros",
      "rear-delts": "Deltoides posterior",
      biceps: "Bíceps",
      triceps: "Tríceps",
      forearms: "Antebrazos",
      core: "Core",
      "upper-back": "Espalda alta",
      lats: "Dorsales",
      "lower-back": "Lumbares",
      glutes: "Glúteos",
      quads: "Cuádriceps",
      hamstrings: "Isquios",
      adductors: "Aductores",
      hips: "Cadera",
      calves: "Gemelos",
      cardio: "Cardio",
      mobility: "Movilidad",
    },
    equipment: {
      barbell: "Barra",
      dumbbell: "Mancuernas",
      machine: "Máquina",
      cable: "Polea",
      bodyweight: "Peso corporal",
      band: "Banda elástica",
      kettlebell: "Kettlebell",
      plate: "Disco",
      "pull-up-bar": "Barra de dominadas",
      cardio: "Cardio",
      bench: "Banco",
      box: "Cajón",
      wall: "Pared",
      towel: "Toalla",
      doorway: "Marco de puerta",
      chair: "Silla",
      "stability-ball": "Fitball",
    },
  },
  en: {
    name: "Training",
    description: "Each day's workout with sets, reps and load, drawn exercise by exercise.",
    example: "Friday is push day: bench press 4 × 8",
    empty: "No training. Try: “Mondays are leg day: squats 5 × 5”.",
    defaultTitle: "Workout",
    exercises: (n) => plural(n, "1 exercise", "# exercises"),
    workouts: (n) => plural(n, "1 workout", "# workouts"),
    sets: (n) => plural(n, "1 set", "# sets"),
    minutes: (n) => `≈ ${n} min`,
    done: "Workout done",
    markDone: "Mark workout as done",
    markUndone: "Mark workout as not done",
    works: (list) => `Works ${list}`,
    musclesLabel: (list) => `Muscles worked: ${list}`,
    primary: "Main",
    secondary: "Also works",
    equipmentLabel: "Equipment",
    sequence: "Movement sequence",
    phase: (n) => `Phase ${n}`,
    openExercise: (name) => `View “${name}”`,
    noArt: "No drawing",
    credit: "Illustration: Workout Guide (Bryl Lim), based on Everkinetic · CC BY-SA 4.0",
    source: "Exercise data: Workout Guide (Bryl Lim) · MIT",
    and: " and ",
    editor: {
      newExercise: "New exercise",
      editExercise: "Edit exercise",
      workoutTitle: "Workout name",
      renameWorkout: "Rename workout",
      editWorkout: "Edit workout",
      workoutTime: "Time",
      removeWorkout: "Remove workout",
      exercise: "Exercise",
      sets: "Sets",
      reps: "Reps",
      load: "Load",
      loadPlaceholder: "80 kg",
    },
    muscles: {
      chest: "Chest",
      shoulders: "Shoulders",
      "rear-delts": "Rear delts",
      biceps: "Biceps",
      triceps: "Triceps",
      forearms: "Forearms",
      core: "Core",
      "upper-back": "Upper back",
      lats: "Lats",
      "lower-back": "Lower back",
      glutes: "Glutes",
      quads: "Quads",
      hamstrings: "Hamstrings",
      adductors: "Adductors",
      hips: "Hips",
      calves: "Calves",
      cardio: "Cardio",
      mobility: "Mobility",
    },
    equipment: {
      barbell: "Barbell",
      dumbbell: "Dumbbells",
      machine: "Machine",
      cable: "Cable",
      bodyweight: "Bodyweight",
      band: "Resistance band",
      kettlebell: "Kettlebell",
      plate: "Plate",
      "pull-up-bar": "Pull-up bar",
      cardio: "Cardio",
      bench: "Bench",
      box: "Box",
      wall: "Wall",
      towel: "Towel",
      doorway: "Doorway",
      chair: "Chair",
      "stability-ball": "Stability ball",
    },
  },
};
