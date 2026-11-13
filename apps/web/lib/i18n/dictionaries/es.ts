import type { Category, ChangeKind, DayKey, MealSlot } from "@powerweek/core";

const plural = (n: number, one: string, many: string) =>
  n === 1 ? one : many.replace("#", String(n));

export const es = {
  meta: {
    title: "PowerWeek — Dile a tu semana qué hacer",
    description:
      "Planificador semanal por voz para tu agenda, tus entrenos y tus comidas. Habla, mira cada cambio y deshaz con un toque.",
  },
  common: {
    appName: "PowerWeek",
    openApp: "Abrir la app",
    signIn: "Entrar",
    signOut: "Cerrar sesión",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    add: "Añadir",
    close: "Cerrar",
    undo: "Deshacer",
    ok: "Vale",
    loading: "Cargando…",
    retry: "Reintentar",
    language: "Idioma",
    skipToContent: "Saltar al contenido",
  },
  days: {
    long: {
      mon: "Lunes",
      tue: "Martes",
      wed: "Miércoles",
      thu: "Jueves",
      fri: "Viernes",
      sat: "Sábado",
      sun: "Domingo",
    } satisfies Record<DayKey, string>,
    initial: {
      mon: "L",
      tue: "M",
      wed: "X",
      thu: "J",
      fri: "V",
      sat: "S",
      sun: "D",
    } satisfies Record<DayKey, string>,
  },
  categories: {
    agenda: "Agenda",
    train: "Entreno",
    fuel: "Comidas",
  } satisfies Record<Category, string>,
  slots: {
    breakfast: "Desayuno",
    lunch: "Comida",
    snack: "Picoteo",
    dinner: "Cena",
  } satisfies Record<MealSlot, string>,
  landing: {
    eyebrow: "Planificador semanal · por voz",
    headline: "Dile a tu semana qué hacer.",
    lead: "Habla o escribe como se lo dirías a un amigo. PowerWeek ordena tu agenda, tus entrenos y tus comidas, y te enseña cada cambio antes de que se te olvide.",
    ctaPrimary: "Empezar sin cuenta",
    ctaSecondary: "Ver el código",
    navHow: "Cómo funciona",
    navCode: "Código abierto",
    heroNote: "Gratis y de código abierto. Funciona en el navegador y se instala como app.",
    demoListening: "Te escucho",
    demo: [
      {
        command: "«Los martes y jueves, pádel a las 19:00»",
        title: "2 cambios en tu semana",
        changes: [
          { op: "+", day: "MAR", text: "Pádel 19:00" },
          { op: "+", day: "JUE", text: "Pádel 19:00" },
        ],
        bars: [0.55, 0.62, 0.8, 0.5, 0.74, 0.22, 0.4],
      },
      {
        command: "«El viernes empuje: press banca 4 × 8 y fondos 3 × 12»",
        title: "2 cambios en tu semana",
        changes: [
          { op: "+", day: "VIE", text: "Press banca 4 × 8" },
          { op: "+", day: "VIE", text: "Fondos 3 × 12" },
        ],
        bars: [0.55, 0.62, 0.8, 0.5, 1, 0.22, 0.4],
      },
      {
        command: "«Quita la cena del domingo y pasa el dentista al jueves»",
        title: "2 cambios en tu semana",
        changes: [
          { op: "−", day: "DOM", text: "Cena fuera" },
          { op: "→", day: "MIÉ", text: "Dentista → JUE" },
        ],
        bars: [0.55, 0.62, 0.68, 0.62, 1, 0.22, 0.28],
      },
    ] as {
      command: string;
      title: string;
      changes: { op: string; day: string; text: string }[];
      bars: number[];
    }[],
    howTitle: "Tres pasos. Ningún formulario.",
    steps: [
      {
        title: "Habla o escribe",
        body: "«Los lunes hago pierna», «quita la cena del viernes», «mueve el dentista al jueves». En español o en inglés, con tus palabras.",
      },
      {
        title: "Mira cada cambio",
        body: "Un recibo te enseña qué se ha añadido, cambiado o quitado. ¿No era eso? Deshaces con un toque.",
      },
      {
        title: "Cumple tu día",
        body: "Hoy abre con lo que toca. Marca lo hecho y mira cómo late tu semana en el pulso de siete barras.",
      },
    ],
    categoriesTitle: "Una semana. Tres frentes.",
    categoriesExample: {
      agenda: "«Los miércoles, inglés de 20:00 a 21:00»",
      train: "«El viernes empuje: press banca 4 × 8»",
      fuel: "«Entre semana desayuno avena con plátano»",
    } satisfies Record<Category, string>,
    categoriesBody: {
      agenda: "Citas, trabajo y planes con su hora. Lo que se repite cada semana, se queda.",
      train:
        "Rutinas por día con series, repeticiones y peso. Dicta «press banca cuatro por ocho» y listo.",
      fuel: "Desayuno, comida, cena y picoteo. Tu menú de la semana, sin hojas de cálculo.",
    } satisfies Record<Category, string>,
    platformsTitle: "Una app. Todas tus pantallas.",
    platformsBody:
      "La web es la app. Las versiones para móvil y escritorio cargan la misma web, así que se actualizan solas y tu semana se sincroniza al momento.",
    platformWeb: "Web y PWA",
    available: "Ya disponible",
    soon: "Próximamente",
    openSourceTitle: "Código abierto.",
    openSourceBody:
      "Next.js, Supabase y Vercel. Lee la arquitectura, abre un issue o manda tu primera pull request.",
    finalCta: "Tu semana empieza cuando hablas.",
    footer: "Hecho por TUKK Team",
    license: "Licencia MIT",
  },
  login: {
    title: "Entra en tu semana",
    lead: "Empieza al momento sin cuenta. Si quieres usarla en varios dispositivos, entra con tu email.",
    anonymous: "Empezar sin cuenta",
    anonymousHint: "Podrás añadir tu email más tarde sin perder nada.",
    or: "o",
    emailLabel: "Email",
    emailPlaceholder: "tu@email.com",
    sendLink: "Enviarme un enlace",
    sending: "Enviando…",
    linkSent: (email: string) =>
      `Te hemos enviado un enlace a ${email}. Ábrelo en este dispositivo para entrar.`,
    starting: "Preparando tu semana…",
    errorGeneric: "No hemos podido entrar. Inténtalo de nuevo.",
    errorEmail: "No hemos podido enviar el email. Revisa la dirección o prueba más tarde.",
    callbackError: "El enlace ha caducado o ya se usó. Pide uno nuevo.",
  },
  app: {
    navToday: "Hoy",
    navWeek: "Semana",
    navSettings: "Ajustes",
    todayEyebrow: (date: string) => `Hoy · ${date}`,
    dayEyebrow: (date: string) => date,
    weekEyebrow: (week: number, range: string) => `Semana ${week} · ${range}`,
    weekTitle: "Tu semana",
    daySummary: (total: number, done: number) =>
      total === 0
        ? "Nada planificado todavía"
        : `${plural(total, "1 cosa", "# cosas")} en tu día · ${plural(done, "1 hecha", "# hechas")}`,
    weekSummary: (total: number) =>
      total === 0
        ? "Tu semana está en blanco"
        : `${plural(total, "1 cosa planificada", "# cosas planificadas")}`,
    pulseLabel: "Tu semana",
    pulseDay: (day: string, count: number, isToday: boolean) =>
      `${day}${isToday ? ", hoy" : ""}, ${count === 0 ? "sin elementos" : plural(count, "1 elemento", "# elementos")}`,
    backToToday: "Volver a hoy",
    empty: {
      agenda: "Nada en la agenda. Prueba: «el jueves dentista a las 13:30».",
      train: "Sin entreno. Prueba: «los lunes hago pierna: sentadilla 5 × 5».",
      fuel: "Sin comidas. Prueba: «el viernes ceno salmón con verduras».",
    } satisfies Record<Category, string>,
    weekEmptyDay: "Día libre.",
    defaultWorkoutTitle: "Entrenamiento",
    markDone: (title: string) => `Marcar «${title}» como hecho`,
    markUndone: (title: string) => `Desmarcar «${title}»`,
    editItem: (title: string) => `Editar «${title}»`,
    addTo: (category: string) => `Añadir a ${category}`,
    note: "Nota del día",
  },
  dock: {
    placeholder: "Dile algo a tu semana…",
    inputLabel: "Escribe un cambio para tu semana",
    speak: "Hablar",
    stop: "Dejar de escuchar y enviar",
    send: "Enviar",
    cancel: "Cancelar",
    listening: "Te escucho",
    thinking: "Ordenando tu semana…",
    hintStop: "Toca para terminar · Esc para cancelar",
    voiceUnsupported: "Tu navegador no admite dictado. Escribe tu cambio.",
    micDenied: "Sin permiso para el micrófono. Actívalo en el navegador o escribe tu cambio.",
    examples: [
      "los lunes hago pierna: sentadilla 5 × 5 y peso muerto rumano 3 × 10",
      "el miércoles pádel a las 18:30",
      "entre semana trabajo de 9 a 18",
      "quita la cena del viernes",
    ],
  },
  receipt: {
    title: (n: number) => plural(n, "1 cambio en tu semana", "# cambios en tu semana"),
    nothing: "No he encontrado nada que cambiar.",
    more: (n: number) => plural(n, "y 1 cambio más", "y # cambios más"),
    undone: "Cambio deshecho.",
    kind: {
      add: "Añadido",
      update: "Cambiado",
      remove: "Quitado",
      move: "Movido",
    } satisfies Record<ChangeKind, string>,
    movedTo: (day: string) => `→ ${day}`,
    exercises: (n: number) => plural(n, "1 ejercicio", "# ejercicios"),
    dayNote: "Nota",
  },
  editor: {
    newTitle: {
      agenda: "Nueva actividad",
      train: "Nuevo ejercicio",
      fuel: "Nueva comida",
    } satisfies Record<Category, string>,
    editTitle: {
      agenda: "Editar actividad",
      train: "Editar ejercicio",
      fuel: "Editar comida",
    } satisfies Record<Category, string>,
    workoutTitle: "Nombre del entreno",
    renameWorkout: "Renombrar entreno",
    removeWorkout: "Quitar entreno",
    title: "Qué",
    time: "Hora",
    endTime: "Hasta",
    note: "Nota",
    exercise: "Ejercicio",
    sets: "Series",
    reps: "Repeticiones",
    load: "Carga",
    loadPlaceholder: "80 kg",
    slot: "Momento",
    meal: "Qué comes",
    optional: "opcional",
  },
  settings: {
    title: "Ajustes",
    account: "Cuenta",
    anonymousTitle: "Estás usando PowerWeek sin cuenta",
    anonymousBody:
      "Tu semana vive solo en este dispositivo hasta que añadas un email. Así podrás abrirla en el móvil y en el ordenador.",
    addEmail: "Guardar mi semana con email",
    emailPending: (email: string) => `Revisa ${email} y abre el enlace para confirmar.`,
    signedInAs: (email: string) => `Entraste como ${email}`,
    appearance: "Apariencia",
    theme: { dark: "Noche", light: "Día", system: "Sistema" },
    languageHint: "Cambia el idioma de la interfaz y del asistente.",
    timeZone: "Zona horaria",
    timeZoneHint: "Define qué día es «hoy».",
    data: "Tus datos",
    export: "Descargar mi semana (JSON)",
    deleteAccount: "Borrar mi cuenta",
    deleteConfirm: "Se borrarán tu semana, tu historial y tu cuenta. No se puede deshacer.",
    deleteConfirmButton: "Sí, borrar todo",
    signOutAnonymousWarning: "Sin email, al cerrar sesión perderás esta semana.",
    saved: "Guardado",
  },
  errors: {
    generic: "Algo ha fallado. Inténtalo de nuevo.",
    network: "Sin conexión. Revisa tu red e inténtalo otra vez.",
    rateLimited: "Has hecho muchos cambios seguidos. Espera un poco.",
    assistantUnavailable: "El asistente no está disponible ahora mismo. Puedes editar a mano.",
    assistantInvalid: "No he entendido bien. Prueba a decirlo de otra forma.",
    conflict: "Tu semana cambió en otro dispositivo. La he actualizado; repite el cambio.",
    notFound: "Esta página no existe.",
    backHome: "Volver al inicio",
  },
};

export type Dictionary = typeof es;
