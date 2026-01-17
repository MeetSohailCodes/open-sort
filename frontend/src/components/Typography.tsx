import type { ElementType, HTMLAttributes, ReactNode } from "react";

type TypographyVariant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "body"
  | "body-sm"
  | "caption"
  | "label"
  | "mono";

const VARIANT_CLASSES: Record<TypographyVariant, string> = {
  display: "font-display text-4xl md:text-5xl font-semibold tracking-tight",
  h1: "font-display text-3xl md:text-4xl font-semibold tracking-tight",
  h2: "font-display text-2xl md:text-3xl font-semibold tracking-tight",
  h3: "font-display text-xl md:text-2xl font-semibold tracking-tight",
  h4: "font-display text-lg md:text-xl font-semibold tracking-tight",
  h5: "font-display text-base md:text-lg font-semibold tracking-tight",
  h6: "font-display text-sm font-semibold tracking-[0.18em] uppercase",
  body: "font-sans text-sm md:text-base leading-relaxed",
  "body-sm": "font-sans text-xs md:text-sm leading-relaxed",
  caption: "font-sans text-[10px] tracking-widest uppercase",
  label: "font-sans text-xs font-semibold tracking-wide",
  mono: "font-mono text-sm",
};

const DEFAULT_TAG: Record<TypographyVariant, ElementType> = {
  display: "h1",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  body: "p",
  "body-sm": "p",
  caption: "span",
  label: "span",
  mono: "span",
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export function Typography({
  as,
  variant = "body",
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  variant?: TypographyVariant;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  const Component = (as || DEFAULT_TAG[variant]) as ElementType;
  return (
    <Component className={cx(VARIANT_CLASSES[variant], className)} {...rest}>
      {children}
    </Component>
  );
}

export function TypographyProvider({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("font-sans antialiased", className)}>{children}</div>;
}
