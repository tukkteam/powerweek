import type { Category } from "@powerweek/core";
import { Plus, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { TONE } from "@/lib/tone";

/** The chrome every Today box shares: icon, title, a counter and an add button. */
export function SectionCard({
  tone,
  icon: Icon,
  title,
  meta,
  addLabel,
  onAdd,
  id,
  className = "",
  children,
}: {
  tone: Category;
  icon: LucideIcon;
  title: ReactNode;
  meta?: ReactNode;
  addLabel: string;
  onAdd: () => void;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`flex flex-col rounded-[14px] border border-line bg-surface p-4 sm:p-5 ${className}`}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="type-heading flex min-w-0 items-center gap-2">
          <Icon
            size={20}
            strokeWidth={1.75}
            className={`shrink-0 ${TONE[tone].text}`}
            aria-hidden="true"
          />
          <span className="truncate">{title}</span>
        </h2>
        {meta !== undefined ? <span className="type-numeric text-ink-muted">{meta}</span> : null}
      </header>
      {children}
      <AddButton label={addLabel} onClick={onAdd} />
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
