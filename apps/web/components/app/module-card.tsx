import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { ModuleIcon } from "@/modules/look";

/**
 * The chrome most module cards share: icon, title, a counter and an add button, in the
 * module's tone. A module is free to draw its card another way.
 */
export function ModuleCard({
  icon,
  title,
  meta,
  addLabel,
  onAdd,
  className = "",
  children,
}: {
  /** The module's icon name. */
  icon: string;
  title: ReactNode;
  meta?: ReactNode;
  addLabel?: string;
  onAdd?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex h-full flex-col rounded-[14px] border border-line bg-surface p-4 sm:p-5 ${className}`}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="type-heading flex min-w-0 items-center gap-2">
          <ModuleIcon name={icon} size={20} strokeWidth={1.75} className="shrink-0 text-tone" />
          <span className="truncate">{title}</span>
        </h2>
        {meta !== undefined ? <span className="type-numeric text-ink-muted">{meta}</span> : null}
      </header>
      {children}
      {addLabel && onAdd ? <AddButton label={addLabel} onClick={onAdd} /> : null}
    </section>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 inline-flex h-11 items-center gap-2 self-start rounded-full px-3 text-[0.9375rem] font-bold text-ink-muted hover:bg-surface-raised hover:text-ink"
    >
      <Plus size={18} strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  );
}

/** The first line of a module's box in the week board: its name and one small fact. */
export function CellHeader({ title, extra }: { title: string; extra?: ReactNode }) {
  return (
    <span className="type-label flex items-center justify-between gap-2 text-tone">
      <span className="truncate">{title}</span>
      {extra !== undefined ? <span className="shrink-0 text-ink-muted">{extra}</span> : null}
    </span>
  );
}
