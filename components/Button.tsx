import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#2563EB] text-white border border-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF]",
  secondary:
    "bg-white text-[#2563EB] border border-[#2563EB] hover:bg-[#EAF2FF] active:bg-[#DBEAFE]",
  ghost:
    "bg-[#F5F7FA] text-[#1F2937] border border-[#D8DEE9] hover:bg-[#EEF1F5] active:bg-[#E5E9EF]",
};

export default function Button({
  variant = "primary",
  fullWidth = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={[
        "inline-flex items-center justify-center",
        "min-h-[44px] px-5 py-2.5",
        "rounded-lg text-sm font-medium",
        "transition-colors duration-150",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
