import { forwardRef, type InputHTMLAttributes } from "react";

export type InputVariant = "default" | "search" | "flat" | "ghost";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: InputVariant;
};

const baseClassName =
  "w-full rounded-2xl border-[3px] px-4 py-3 outline-none transition-[border-color] duration-150";

const variantClassName: Record<InputVariant, string> = {
  default:
    "border-ink bg-surface shadow-[4px_4px_0_var(--color-ink)] hover:border-purple focus:border-purple active:border-purple",
  search:
    "border-ink bg-surface py-4 pl-14 shadow-[4px_4px_0_var(--color-ink)] hover:border-purple focus:border-purple active:border-purple",
  flat: "border-ink bg-surface shadow-none hover:border-purple focus:border-purple active:border-purple",
  ghost:
    "border-transparent bg-transparent shadow-none hover:border-transparent focus:border-purple active:border-purple",
};

export function getInputClassName(
  variant: InputVariant = "default",
  className?: string,
): string {
  return [baseClassName, variantClassName[variant], className ?? ""].filter(Boolean).join(" ");
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ variant = "default", className, ...props }, ref) => (
    <input
      {...props}
      ref={ref}
      className={getInputClassName(variant, className)}
    />
  ),
);

Input.displayName = "Input";

export default Input;
