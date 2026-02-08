import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import {
    BarChart3,
    ShieldCheck,
    Landmark,
    FileStack,
    TrendingUp,
    AlertTriangle,
    Users
} from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/DataDisplay';
import { formatCurrency } from '../../../lib/formatters';

const navItems = [
    { label: 'Dashboard', path: '/national/treasurer', icon: BarChart3 },
    { label: 'NT Reconciliation', path: '/national/treasurer/reconciliation', icon: ShieldCheck },
    { label: 'National Bank', path: '/national/treasurer/bank', icon: Landmark },
    { label: 'Member Ledger', path: '/national/treasurer/ledger', icon: Users },
    { label: 'Global Reports', path: '/national/treasurer/reports', icon: FileStack },
];

export default function NationalTreasurerDashboard() {
    const { data: summary, isLoading } = useQuery({
        queryKey: ['national-treasurer-summary'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('v_national_treasurer_summary')
                .select('*');
            if (error) throw error;
            return data;
        },
    });

    return (
        <DashboardLayout navItems={navItems} title="Global Treasury Dashboard">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-secondary text-white">
                    <CardContent className="p-8">
                        <ShieldCheck size={48} className="opacity-20 absolute top-4 right-4" />
                        <p className="text-sm font-medium uppercase opacity-80">Global Liquidity</p>
                        <p className="text-4xl font-black mt-2">
                            {formatCurrency(summary?.reduce((acc: number, item: any) => acc + item.current_balance, 0) || 0)}
                        </p>
                        <p className="text-xs opacity-80 mt-4">Verified funds in national treasury</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-8">
                        <p className="text-sm font-medium text-muted-foreground uppercase">Unverified Transfers</p>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="text-3xl font-bold text-accent">12</span>
                            <AlertTriangle size={24} className="text-accent" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-4">Awaiting confirmation from Chapters</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-8">
                        <p className="text-sm font-medium text-muted-foreground uppercase">System Status</p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="w-3 h-3 bg-secondary rounded-full animate-pulse" />
                            <span className="text-xl font-bold text-foreground">Healthy</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-4">All chapter balances within margin</p>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-8">
                <Card>
                    <div className="p-6 border-b border-border flex items-center justify-between">
                        <h3 className="font-bold flex items-center gap-2">
                            <TrendingUp size={18} className="text-secondary" />
                            National Purpose Distribution
                        </h3>
                    </div>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-background-alt text-[10px] font-black uppercase text-muted-foreground border-b border-border">
                                    <tr>
                                        <th className="px-6 py-4">Purpose Name</th>
                                        <th className="px-6 py-4">Expected (Global)</th>
                                        <th className="px-6 py-4">Actual (In Hand)</th>
                                        <th className="px-6 py-4">Realization %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {isLoading ? (
                                        <tr className="animate-pulse"><td colSpan={4} className="p-10 text-center">Crunching numbers...</td></tr>
                                    ) : summary?.map((p: any) => (
                                        <tr key={p.purpose_id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4 font-bold">{p.purpose_name}</td>
                                            <td className="px-6 py-4 text-muted-foreground">{formatCurrency(p.total_expected)}</td>
                                            <td className="px-6 py-4 font-black text-secondary">{formatCurrency(p.total_collected)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-1.5 bg-muted rounded-full">
                                                        <div
                                                            className="h-full bg-secondary rounded-full"
                                                            style={{ width: `${Math.min(100, (p.total_collected / (p.total_expected || 1)) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold">{Math.round((p.total_collected / (p.total_expected || 1)) * 100)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
