import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold select-none transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/80 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-fg shadow-[0_2px_0_0_color-mix(in_oklab,var(--color-fg)_22%,transparent)] disabled:bg-bg-subtle disabled:text-muted disabled:shadow-none",
        secondary:
          "bg-surface text-fg ring-1 ring-border hover:ring-border-strong",
        ghost: "text-fg hover:bg-bg-subtle",
      },
      size: {
        lg: "h-12 w-full px-5 text-base rounded-xl",
        md: "h-11 px-4 text-sm rounded-lg",
        icon: "size-11 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "lg",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
