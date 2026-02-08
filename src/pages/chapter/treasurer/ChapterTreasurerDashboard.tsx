import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import {
    BarChart3,
    CheckCircle2,
    AlertTriangle,
    TrendingUp,
    ArrowRightLeft,
    Landmark,
    FileSpreadsheet
} from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/DataDisplay';
import { Button } from '../../../components/ui/Button';
import { formatCurrency } from '../../../lib/formatters';

const navItems = [
    { label: 'Dashboard', path: '/chapter/treasurer', icon: BarChart3 },
    { label: 'Reconciliation', path: '/chapter/treasurer/reconciliation', icon: CheckCircle2 },
    { label: 'Bank Transactions', path: '/chapter/treasurer/bank', icon: Landmark },
    { label: 'Forward to National', path: '/chapter/treasurer/forward', icon: ArrowRightLeft },
    { label: 'Reports', path: '/chapter/treasurer/reports', icon: FileSpreadsheet },
];

export default function ChapterTreasurerDashboard() {
    const { profile } = useAuth();

    const { data: reconSummary, isLoading } = useQuery({
        queryKey: ['chapter-reconciliation', profile?.chapter_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('v_chapter_reconciliation')
                .select('*')
                .eq('chapter_id', profile?.chapter_id);
            if (error) throw error;
            return data;
        },
        enabled: !!profile?.chapter_id,
    });

    const totalDifference = reconSummary?.reduce((acc: number, item: any) => acc + item.difference, 0) || 0;

    return (
        <DashboardLayout navItems={navItems} title="Treasurer Dashboard">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className={totalDifference === 0 ? 'bg-secondary/10 border-secondary/20' : 'bg-destructive/10 border-destructive/20'}>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold uppercase text-muted-foreground">Status</p>
                            {totalDifference === 0 ? <CheckCircle2 className="text-secondary" /> : <AlertTriangle className="text-destructive" />}
                        </div>
                        <p className={`text-2xl font-black mt-2 ${totalDifference === 0 ? 'text-secondary' : 'text-destructive'}`}>
                            {totalDifference === 0 ? 'BALANCED' : 'UNBALANCED'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Overall difference across all purposes
                        </p>
                    </CardContent>
                </Card>

                {/* Total Handed Over */}
                <Card>
                    <CardContent className="p-6">
                        <p className="text-sm font-semibold uppercase text-muted-foreground">Stated Handover</p>
                        <p className="text-2xl font-black mt-2">
                            {formatCurrency(reconSummary?.reduce((acc: number, item: any) => acc + item.fs_handed_over, 0) || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Total amount FS claimed to hand over</p>
                    </CardContent>
                </Card>

                {/* Total Received */}
                <Card>
                    <CardContent className="p-6">
                        <p className="text-sm font-semibold uppercase text-muted-foreground">Actually Received</p>
                        <p className="text-2xl font-black mt-2 text-secondary">
                            {formatCurrency(reconSummary?.reduce((acc: number, item: any) => acc + item.treasurer_received, 0) || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Total amount you confirmed receiving</p>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-8">
                <Card>
                    <div className="p-6 border-b border-border">
                        <h3 className="font-bold">Purpose-wise Reconciliation</h3>
                    </div>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {isLoading ? (
                                <div className="p-12 text-center animate-pulse">Loading reconciliation data...</div>
                            ) : reconSummary?.map((item: any) => (
                                <div key={item.purpose_id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                                    <div>
                                        <h4 className="font-bold text-lg">{item.purpose_name}</h4>
                                        <p className="text-sm text-muted-foreground">Chapter Purpose</p>
                                    </div>
                                    <div className="flex items-center gap-12">
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground uppercase font-bold">FS Stated</p>
                                            <p className="font-semibold">{formatCurrency(item.fs_handed_over)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground uppercase font-bold">You Received</p>
                                            <p className="font-semibold text-secondary">{formatCurrency(item.treasurer_received)}</p>
                                        </div>
                                        <div className="text-right min-w-[100px]">
                                            <p className="text-xs text-muted-foreground uppercase font-bold">Difference</p>
                                            <p className={`font-black ${item.difference === 0 ? 'text-secondary' : 'text-destructive'}`}>
                                                {formatCurrency(item.difference)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
