import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import { BarChart3, ShieldCheck, Landmark, FileStack, Download, PieChart as PieChartIcon, Activity, Loader2, Users } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/DataDisplay';
import { Button } from '../../../components/ui/Button';
import { supabase } from '../../../lib/supabase';
import { exportToCSV } from '../../../lib/export';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const navItems = [
    { label: 'Dashboard', path: '/national/treasurer', icon: BarChart3 },
    { label: 'NT Reconciliation', path: '/national/treasurer/reconciliation', icon: ShieldCheck },
    { label: 'National Bank', path: '/national/treasurer/bank', icon: Landmark },
    { label: 'Member Ledger', path: '/national/treasurer/ledger', icon: Users },
    { label: 'Global Reports', path: '/national/treasurer/reports', icon: FileStack },
];

export default function NationalTreasurerReports() {
    const [exporting, setExporting] = useState<string | null>(null);

    const { data: globalSummary } = useQuery({
        queryKey: ['global-liquidity-summary'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('v_national_treasurer_summary')
                .select('*');
            if (error) throw error;
            return data;
        }
    });

    const handleExport = async (type: string) => {
        setExporting(type);
        try {
            if (type === 'Consolidated Balance Sheet') {
                const { data, error } = await supabase
                    .from('v_national_treasurer_summary')
                    .select('*');
                if (error) throw error;
                exportToCSV(data, 'global_balances', ['Purpose Name', 'Current Balance', 'Total Expected']);
            }
            else if (type === 'Inter-Treasury Audit') {
                const { data, error } = await supabase
                    .from('chapter_national_transfers')
                    .select('chapter_id, amount, status, transferred_at, confirmed_at');
                if (error) throw error;
                exportToCSV(data, 'treasury_audit', ['Amount', 'Status', 'Transferred At']);
            }
            if (type === 'National Bank Activity') {
                const { data, error } = await supabase
                    .from('national_bank_transactions')
                    .select('*');
                if (error) throw error;
                exportToCSV(data, 'national_bank_log', ['Amount', 'Transaction Type', 'Transaction Date', 'Reference Number']);
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to generate report.');
        } finally {
            setExporting(null);
        }
    };

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const pieData = globalSummary?.map(d => ({
        name: d.purpose_name,
        value: parseFloat(d.current_balance)
    })).filter(d => d.value > 0) || [];

    return (
        <DashboardLayout navItems={navItems} title="Global Treasury - Strategic Insights">
            <div className="mb-8">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-lg font-bold">Global Liquidity Distribution</h3>
                                <p className="text-sm text-muted-foreground">Cash assets aggregated by purpose across all chapters</p>
                            </div>
                            <PieChartIcon size={24} className="text-secondary" />
                        </div>
                        <div className="h-[350px] w-full">
                            {pieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            innerRadius={80}
                                            outerRadius={120}
                                            paddingAngle={8}
                                            dataKey="value"
                                        >
                                            {pieData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                                        />
                                        <Legend verticalAlign="middle" align="right" layout="vertical" />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground italic">
                                    Strategic liquidity data loading...
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { title: 'Consolidated Balance Sheet', desc: 'Global overview of associations liquidity, purpose-wise assets.', icon: PieChartIcon },
                    { title: 'Inter-Treasury Audit', desc: 'Verification log of all cash movements between Chapter and National Treasuries.', icon: Activity },
                    { title: 'National Bank Activity', desc: 'Consolidated logs of all withdrawals and deposits at the national level.', icon: Landmark },
                ].map((report) => (
                    <Card key={report.title} className="hover:border-primary/50 transition-all group">
                        <CardContent className="p-8">
                            <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary mb-6 group-hover:scale-110 transition-transform">
                                <report.icon size={24} />
                            </div>
                            <h3 className="font-bold text-lg mb-2">{report.title}</h3>
                            <p className="text-sm text-muted-foreground mb-8">
                                {report.desc}
                            </p>
                            <Button
                                variant="outline"
                                className="w-full flex items-center gap-2"
                                onClick={() => handleExport(report.title)}
                                disabled={!!exporting}
                            >
                                {exporting === report.title ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    <Download size={18} />
                                )}
                                Export CSV
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </DashboardLayout>
    );
}
