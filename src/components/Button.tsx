import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "filter"
  | "vote";

type ButtonStyleProps = {
  variant?: ButtonVariant;
  className?: string;
  fullWidth?: boolean;
  children?: ReactNode;
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleProps;
type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> &
  ButtonStyleProps & { href: string };

function wrapperClassName(
  variant: ButtonVariant,
  className: string | undefined,
  fullWidth: boolean,
) {
  return [
    "toon-button-shell",
    variant === "primary" || variant === "secondary" ? "toon-button-shell--raised" : "",
    fullWidth ? "w-full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

function controlClassName(variant: ButtonVariant, fullWidth: boolean) {
  return [
    "toon-button-control",
    `toon-button-control--${variant}`,
    fullWidth ? "w-full" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant = "primary",
  className,
  fullWidth = false,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <span className={wrapperClassName(variant, className, fullWidth)}>
      <button {...props} type={type} className={controlClassName(variant, fullWidth)}>
        {children}
      </button>
    </span>
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  fullWidth = false,
  children,
  href,
  ...props
}: ButtonLinkProps) {
  return (
    <span className={wrapperClassName(variant, className, fullWidth)}>
      <a
        {...props}
        href={href}
        className={controlClassName(variant, fullWidth)}
      >
        {children}
      </a>
    </span>
  );
}
