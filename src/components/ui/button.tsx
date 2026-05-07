import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "btn-futuristic relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform hover:[&_svg]:scale-110",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-primary via-primary to-[hsl(285_55%_55%)] text-primary-foreground shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.6)] hover:shadow-[0_10px_30px_-6px_hsl(var(--primary)/0.85)] hover:-translate-y-0.5 hover:brightness-110",
        destructive:
          "bg-gradient-to-br from-destructive to-[hsl(340_85%_55%)] text-destructive-foreground shadow-[0_6px_20px_-6px_hsl(var(--destructive)/0.55)] hover:shadow-[0_10px_30px_-6px_hsl(var(--destructive)/0.8)] hover:-translate-y-0.5",
        outline:
          "border border-input bg-background/60 backdrop-blur hover:bg-accent hover:text-accent-foreground hover:border-primary/60 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.4),0_8px_24px_-10px_hsl(var(--primary)/0.4)] hover:-translate-y-0.5",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:-translate-y-0.5 hover:shadow-md",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
