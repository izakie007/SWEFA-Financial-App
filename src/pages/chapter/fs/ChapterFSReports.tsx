import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import { LayoutDashboard, Users, HandCoins, History, FileText, Download, PieChart, Landmark, Loader2, BarChart, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/DataDisplay';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../lib/supabase';
import { exportToCSV } from '../../../lib/export';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const navItems = [
    { label: 'Dashboard', path: '/chapter/fs', icon: LayoutDashboard },
    { label: 'Member Ledger', path: '/chapter/fs/ledger', icon: Users },
    { label: 'Member Register', path: '/chapter/fs/members', icon: Users },
    { label: 'Record Transaction', path: '/chapter/fs/record', icon: HandCoins },
    { label: 'Handover', path: '/chapter/fs/handover', icon: History },
    { label: 'Reports', path: '/chapter/fs/reports', icon: FileText },
];

export default function ChapterFSReports() {
    const { profile } = useAuth();
    const [exporting, setExporting] = useState<string | null>(null);

    // Fetch purpose summary for visual analytics
    const { data: summaryData } = useQuery({
        queryKey: ['chapter-purpose-summary', profile?.chapter_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('v_chapter_purpose_summary')
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
            if (type === 'Goal Realization Report') {
                const { data, error } = await supabase
                    .from('v_chapter_purpose_summary')
                    .select('purpose_name, total_collected, total_expected, contributors')
                    .eq('chapter_id', profile?.chapter_id);
                if (error) throw error;
                exportToCSV(data, 'goal_realization', ['Purpose Name', 'Total Collected', 'Total Expected', 'Contributors']);
            }
            else if (type === 'Member Delinquency List') {
                const { data, error } = await supabase
                    .from('v_members_pending_contributions')
                    .select('full_name, purpose_name, amount_paid, expected_amount, balance')
                    .eq('chapter_id', profile?.chapter_id);
                if (error) throw error;
                exportToCSV(data, 'delinquency_list', ['Full Name', 'Purpose Name', 'Amount Paid', 'Expected Amount', 'Balance']);
            }
            else if (type === 'Handover Reconciliation') {
                const { data, error } = await supabase
                    .from('v_chapter_reconciliation')
                    .select('purpose_name, fs_handed_over, treasurer_received, difference')
                    .eq('chapter_id', profile?.chapter_id);
                if (error) throw error;
                exportToCSV(data, 'handover_log', ['Purpose Name', 'FS Handed Over', 'Treasurer Received', 'Difference']);
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to generate report.');
        } finally {
            setExporting(null);
        }
    };

    const chartData = summaryData?.map(d => ({
        name: d.purpose_name,
        Percentage: Math.round((d.total_collected / d.total_expected) * 100) || 0
    })) || [];

    return (
        <DashboardLayout navItems={navItems} title="Reporting & Analytics">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <Card className="lg:col-span-2">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-lg font-bold">Goal Realization Progress</h3>
                                <p className="text-sm text-muted-foreground">Percentage of targets reached per purpose</p>
                            </div>
                            <BarChart size={24} className="text-primary" />
                        </div>
                        <div className="h-[300px] w-full">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ReBarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--foreground), 0.1)" />
                                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                                            cursor={{ fill: 'rgba(var(--primary), 0.1)' }}
                                        />
                                        <Bar dataKey="Percentage" radius={[4, 4, 0, 0]} barSize={40}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.Percentage >= 100 ? '#10b981' : '#f59e0b'} />
                                            ))}
                                        </Bar>
                                    </ReBarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground italic">
                                    Insufficient data for charting
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 h-full flex flex-col">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-xl bg-destructive/10 text-destructive">
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold">Summary Metrics</h3>
                                <p className="text-xs text-muted-foreground">Critical chapter KPIs</p>
                            </div>
                        </div>
                        <div className="space-y-6 flex-1">
                            <div className="p-4 rounded-2xl bg-muted/50 border border-border">
                                <p className="text-xs text-muted-foreground mb-1 uppercase font-bold tracking-wider">Total Collection Rate</p>
                                <p className="text-2xl font-black">
                                    {Math.round(chartData.reduce((acc, curr) => acc + curr.Percentage, 0) / (chartData.length || 1))}%
                                </p>
                            </div>
                            <div className="p-4 rounded-2xl bg-muted/50 border border-border">
                                <p className="text-xs text-muted-foreground mb-1 uppercase font-bold tracking-wider">Fully Funded Purposes</p>
                                <p className="text-2xl font-black">{chartData.filter(d => d.Percentage >= 100).length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { title: 'Goal Realization Report', desc: 'Detailed progress vs targets for each purpose.', icon: PieChart },
                    { title: 'Member Delinquency List', desc: 'Members with outstanding contributions or arrears.', icon: Users },
                    { title: 'Handover Reconciliation', desc: 'Reconciliation log of funds handed to Treasure.', icon: Landmark },
                ].map((report) => (
                    <Card key={report.title} className="hover:border-primary/50 transition-all group">
                        <CardContent className="p-8">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
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
