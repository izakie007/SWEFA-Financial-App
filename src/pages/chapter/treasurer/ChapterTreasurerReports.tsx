import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import {
    BarChart3,
    CheckCircle2,
    Landmark,
    ArrowRightLeft,
    FileSpreadsheet,
    Download,
    Loader2,
    PieChart as PieChartIcon,
    AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/DataDisplay';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../lib/supabase';
import { exportToCSV } from '../../../lib/export';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const navItems = [
    { label: 'Dashboard', path: '/chapter/treasurer', icon: BarChart3 },
    { label: 'Reconciliation', path: '/chapter/treasurer/reconciliation', icon: CheckCircle2 },
    { label: 'Bank Activity', path: '/chapter/treasurer/bank', icon: Landmark },
    { label: 'Forward Money', path: '/chapter/treasurer/forward', icon: ArrowRightLeft },
    { label: 'Reports', path: '/chapter/treasurer/reports', icon: FileSpreadsheet },
];

export default function ChapterTreasurerReports() {
    const { profile } = useAuth();
    const [exporting, setExporting] = useState<string | null>(null);

    const { data: reconciliationData } = useQuery({
        queryKey: ['chapter-reconciliation-summary', profile?.chapter_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('v_chapter_reconciliation')
                .select('*')
                .eq('chapter_id', profile?.chapter_id);
            if (error) throw error;
            return data;
        },
        enabled: !!profile?.chapter_id
    });

    const handleExport = async (type: string) => {
        setExporting(type);
        try {
            if (type === 'Monthly Financial Statement') {
                const { data, error } = await supabase
                    .from('v_chapter_reconciliation')
                    .select('purpose_name, fs_handed_over, treasurer_received, difference')
                    .eq('chapter_id', profile?.chapter_id);
                if (error) throw error;
                exportToCSV(data, 'financial_statement', ['Purpose', 'Handover Total', 'Received Total', 'Difference']);
            }
            else if (type === 'National Transfer Log') {
                const { data, error } = await supabase
                    .from('chapter_national_transfers')
                    .select('amount, status, transferred_at, confirmed_at')
                    .eq('chapter_id', profile?.chapter_id);
                if (error) throw error;
                exportToCSV(data, 'national_transfers', ['Amount', 'Status', 'Sent At', 'Confirmed At']);
            }
            else if (type === 'Bank Activity Report') {
                const { data, error } = await supabase
                    .from('chapter_bank_transactions')
                    .select('amount, transaction_type, transaction_date, reference_number')
                    .eq('chapter_id', profile?.chapter_id);
                if (error) throw error;
                exportToCSV(data, 'bank_activity', ['Amount', 'Type', 'Date', 'Reference']);
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to generate report.');
        } finally {
            setExporting(null);
        }
    };

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const pieData = reconciliationData?.map(d => ({
        name: d.purpose_name,
        value: parseFloat(d.treasurer_received)
    })).filter(d => d.value > 0) || [];

    return (
        <DashboardLayout navItems={navItems} title="Financial Oversight & Reporting">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <Card className="lg:col-span-2">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-lg font-bold">Fund Distribution</h3>
                                <p className="text-sm text-muted-foreground">Cash allocation across various purposes</p>
                            </div>
                            <PieChartIcon size={24} className="text-secondary" />
                        </div>
                        <div className="h-[300px] w-full">
                            {pieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
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
                                    No funds recorded yet
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 h-full flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-xl bg-secondary/10 text-secondary">
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold">Account Health</h3>
                                <p className="text-xs text-muted-foreground">Handover vs Receipt status</p>
                            </div>
                        </div>
                        <div className="space-y-6 flex-1">
                            {reconciliationData?.some(d => parseFloat(d.difference) !== 0) ? (
                                <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive">
                                    <p className="text-xs mb-1 uppercase font-bold">Unreconciled Difference</p>
                                    <p className="text-2xl font-black">
                                        XAF {reconciliationData.reduce((acc, curr) => acc + Math.abs(parseFloat(curr.difference)), 0).toLocaleString()}
                                    </p>
                                    <p className="text-[10px] mt-2 italic opacity-80">Requires immediate verification with FS</p>
                                </div>
                            ) : (
                                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                                    <p className="text-xs mb-1 uppercase font-bold">Account Status</p>
                                    <p className="text-2xl font-black italic">Perfectly Balanced</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <CheckCircle2 size={14} />
                                        <span className="text-[10px]">All handovers verified</span>
                                    </div>
                                </div>
                            )}
                            <div className="p-4 rounded-2xl bg-muted/50 border border-border">
                                <p className="text-xs text-muted-foreground mb-1 uppercase font-bold tracking-wider">Total Liquidity Managed</p>
                                <p className="text-2xl font-black">
                                    XAF {reconciliationData?.reduce((acc, curr) => acc + parseFloat(curr.treasurer_received), 0).toLocaleString() || '0'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { title: 'Monthly Financial Statement', desc: 'Consolidated report of all receipts and balances.', icon: FileSpreadsheet },
                    { title: 'National Transfer Log', desc: 'Verification of all funds forwarded to National Treasury.', icon: ArrowRightLeft },
                    { title: 'Bank Activity Report', desc: 'Complete logs of bank deposits and withdrawals.', icon: Landmark },
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
                                {exporting === report.title ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                                Export CSV
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </DashboardLayout>
    );
}
