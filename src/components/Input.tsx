import { forwardRef, type InputHTMLAttributes } from "react";

export type InputVariant = "default" | "search";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: InputVariant;
};

const variantClassName: Record<InputVariant, string> = {
  default: "",
  search: "py-4 pl-14",
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ variant = "default", className, ...props }, ref) => (
    <input
      {...props}
      ref={ref}
      className={["toon-input", variantClassName[variant], className ?? ""]
        .filter(Boolean)
        .join(" ")}
    />
  ),
);

Input.displayName = "Input";

export default Input;
