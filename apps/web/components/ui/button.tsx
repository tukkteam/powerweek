import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "inverse";
type Size = "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap select-none transition-[transform,background-color,color,border-color] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40";

const variants: Record<Variant, string> = {
  primary: "bg-volt text-on-volt hover:brightness-105",
  secondary: "border border-line-strong text-ink hover:bg-surface-raised",
  ghost: "text-ink-muted hover:text-ink hover:bg-surface-raised",
  danger: "border border-line-strong text-danger hover:bg-surface-raised",
  inverse: "bg-bg text-ink hover:opacity-90",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-13 px-7 text-base",
  icon: "size-11 shrink-0",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra = ""): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
