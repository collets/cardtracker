import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-cyan-300 text-slate-950 shadow-sm shadow-cyan-950/20 hover:bg-cyan-200 hover:shadow-md hover:shadow-cyan-300/15",
        secondary:
          "border border-white/10 bg-white/10 text-white hover:border-white/20 hover:bg-white/15",
        outline:
          "border border-white/15 bg-transparent hover:border-cyan-300/35 hover:bg-cyan-300/10 hover:text-cyan-100",
        ghost:
          "text-slate-300 hover:bg-white/10 hover:text-white hover:shadow-sm hover:shadow-black/20",
        destructive:
          "bg-red-500 text-white shadow-sm shadow-red-950/20 hover:bg-red-400 hover:shadow-md hover:shadow-red-500/15",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-xl px-6",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { buttonVariants };
