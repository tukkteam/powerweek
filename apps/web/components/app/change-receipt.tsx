"use client";

import { Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app/app-provider";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { describeChange, OP_CLASS, OP_SYMBOL, whereChanged } from "@/lib/format";
import { kernel } from "@/modules";
import { toneStyle } from "@/modules/look";

const VISIBLE = 5;

/** Proof of every edit: what changed, in which day, and one tap to undo it. */
export function ChangeReceipt() {
  const { receipt, dismissReceipt, undo, dates } = useApp();
  const { lang, dict } = useLocale();
  const [hold, setHold] = useState(false);

  useEffect(() => {
    if (!receipt || hold) return;
    const ms = receipt.source === "assistant" ? 9000 : 5000;
    const id = window.setTimeout(dismissReceipt, ms);
    return () => window.clearTimeout(id);
  }, [receipt, hold, dismissReceipt]);

  if (!receipt) return null;
  const count = receipt.changes.length;
  /** Why nothing changed, when the assistant did ask for something. */
  const unmet = count === 0 ? receipt.problem : null;
  const shown = receipt.changes.slice(0, VISIBLE);

  return (
    <div
      key={receipt.id}
      role="status"
      aria-live="polite"
      onPointerEnter={() => setHold(true)}
      onPointerLeave={() => setHold(false)}
      onFocusCapture={() => setHold(true)}
      onBlurCapture={() => setHold(false)}
      className="pw-rise rounded-3xl border border-line bg-surface-raised p-4 shadow-float"
    >
      <p className="type-heading">
        {count
          ? dict.receipt.title(count)
          : unmet
            ? dict.receipt.failed[unmet]
            : receipt.reply.trim().endsWith("?")
              ? dict.receipt.question
              : dict.receipt.nothing}
      </p>
      {/* When nothing could be done, the assistant's sentence would claim otherwise. */}
      {receipt.reply && receipt.source === "assistant" && !unmet ? (
        <p className="type-caption mt-1 text-ink-muted">{receipt.reply}</p>
      ) : null}

      {count ? (
        <ul className="mt-2 space-y-0.5">
          {shown.map((change, index) => (
            <li
              key={index}
              className="grid grid-cols-[16px_84px_minmax(0,1fr)] items-baseline gap-2 py-1"
            >
              <span
                className={`font-mono font-bold ${OP_CLASS[change.kind]}`}
                aria-label={dict.receipt.kind[change.kind]}
              >
                {OP_SYMBOL[change.kind]}
              </span>
              <span className="type-label truncate text-ink-muted">
                {whereChanged(change, dict, lang, dates)}
              </span>
              <span className="type-body flex min-w-0 items-baseline gap-2">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 translate-y-[-1px] rounded-full bg-tone"
                  style={toneStyle(kernel.get(change.module)?.tone ?? "volt")}
                />
                <span className="truncate">{describeChange(change, dict, lang)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {count > VISIBLE ? (
        <p className="type-caption mt-1 text-ink-muted">{dict.receipt.more(count - VISIBLE)}</p>
      ) : null}
      {count > 0 && receipt.skipped > 0 ? (
        <p className="type-caption mt-1 text-danger">{dict.receipt.skipped(receipt.skipped)}</p>
      ) : null}

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={dismissReceipt}>
          {dict.common.ok}
        </Button>
        {receipt.version ? (
          <Button variant="secondary" onClick={() => void undo()}>
            <Undo2 size={18} strokeWidth={2} aria-hidden="true" />
            {dict.common.undo}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Errors and confirmations that are not a plan change. */
export function NoticeToast() {
  const { notice, dismissNotice } = useApp();
  const { dict } = useLocale();

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(dismissNotice, notice.tone === "error" ? 6000 : 3500);
    return () => window.clearTimeout(id);
  }, [notice, dismissNotice]);

  if (!notice) return null;
  return (
    <div
      key={notice.id}
      role={notice.tone === "error" ? "alert" : "status"}
      className={`pw-rise flex items-start justify-between gap-3 rounded-2xl border bg-surface-raised px-4 py-3 shadow-float ${
        notice.tone === "error" ? "border-danger text-ink" : "border-line text-ink"
      }`}
    >
      <p className="type-body">{notice.text}</p>
      <button
        type="button"
        onClick={dismissNotice}
        aria-label={dict.common.close}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink"
      >
        <X size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
