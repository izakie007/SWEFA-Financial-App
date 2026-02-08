import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
    size?: 'sm' | 'md' | 'lg' | 'icon';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
        const variants = {
            primary: 'premium-gradient text-white shadow-lg shadow-primary/20 hover:shadow-primary/30',
            secondary: 'bg-secondary text-white shadow-lg shadow-secondary/20 hover:bg-secondary-dark',
            outline: 'border border-border bg-transparent hover:bg-muted text-foreground',
            ghost: 'bg-transparent hover:bg-muted text-foreground',
            destructive: 'bg-destructive text-white hover:bg-destructive/90',
        };

        const sizes = {
            sm: 'px-3 py-1.5 text-xs rounded-lg',
            md: 'px-4 py-2 rounded-xl text-sm font-medium',
            lg: 'px-6 py-3 rounded-xl text-base font-semibold',
            icon: 'p-2 rounded-xl',
        };

        return (
            <button
                ref={ref}
                className={cn(
                    'inline-flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            />
        );
    }
);

Button.displayName = 'Button';

export { Button };
