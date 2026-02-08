import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={twMerge('bg-surface border border-border rounded-3xl overflow-hidden', className)}>
        {children}
    </div>
);

export const CardContent = ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={twMerge('p-6', className)}>
        {children}
    </div>
);

export const Table = ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className="overflow-x-auto">
        <table className={twMerge('min-w-full divide-y divide-border', className)}>
            {children}
        </table>
    </div>
);

export const TableHeader = ({ children }: { children: ReactNode }) => (
    <thead className="bg-background-alt">
        {children}
    </thead>
);

export const TableRow = ({ children, className }: { children: ReactNode; className?: string }) => (
    <tr className={twMerge('hover:bg-muted/10 transition-colors', className)}>
        {children}
    </tr>
);

export const TableHeaderCell = ({ children, className }: { children: ReactNode; className?: string }) => (
    <th className={twMerge('px-6 py-4 text-left text-[10px] font-black text-muted-foreground uppercase tracking-wider', className)}>
        {children}
    </th>
);

export const TableCell = ({ children, className, ...props }: { children: ReactNode; className?: string } & React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className={twMerge('px-6 py-4 whitespace-nowrap text-sm text-foreground', className)} {...props}>
        {children}
    </td>
);
