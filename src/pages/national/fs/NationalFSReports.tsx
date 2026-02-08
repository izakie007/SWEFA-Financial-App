import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import { BarChart3, Building2, History, FileText, Download, PieChart, Loader2, Users, BarChart } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/DataDisplay';
import { Button } from '../../../components/ui/Button';
import { supabase } from '../../../lib/supabase';
import { exportToCSV } from '../../../lib/export';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const navItems = [
    { label: 'Dashboard', path: '/national/fs', icon: BarChart3 },
    { label: 'Chapter Transfers', path: '/national/fs/transfers', icon: Building2 },
    { label: 'Handover', path: '/national/fs/handover', icon: History },
    { label: 'Member Ledger', path: '/national/fs/ledger', icon: Users },
    { label: 'Reports', path: '/national/fs/reports', icon: FileText },
];

export default function NationalFSReports() {
    const [exporting, setExporting] = useState<string | null>(null);

    const { data: nationalSummary } = useQuery({
        queryKey: ['national-purpose-summary'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('v_national_purpose_summary')
                .select('*');
            if (error) throw error;
            return data;
        }
    });

    const handleExport = async (type: string) => {
        setExporting(type);
        try {
            if (type === 'Global Purpose Realization') {
                const { data, error } = await supabase
                    .from('v_national_purpose_summary')
                    .select('*');
                if (error) throw error;
                exportToCSV(data, 'global_purpose_realization', ['Purpose Name', 'Total Collected', 'Total Expected']);
            }
            else if (type === 'Chapter Performance Audit') {
                const { data, error } = await supabase
                    .from('v_national_summary')
                    .select('chapter_name, purpose_name, total_amount, contributors');
                if (error) throw error;
                exportToCSV(data, 'chapter_audit', ['Chapter', 'Purpose', 'Amount', 'Contributors']);
            }
            if (type === 'National Handover History') {
                const { data, error } = await supabase
                    .from('national_fs_handover')
                    .select('amount, purpose_id, handed_over_at');
                if (error) throw error;
                exportToCSV(data, 'national_handover_log', ['Amount', 'Purpose Id', 'Handed Over At']);
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to generate report.');
        } finally {
            setExporting(null);
        }
    };

    const chartData = nationalSummary?.map(d => ({
        name: d.purpose_name,
        Collected: parseFloat(d.total_collected),
        Expected: parseFloat(d.total_expected)
    })) || [];

    return (
        <DashboardLayout navItems={navItems} title="Association-Wide Strategic Reports">
            <div className="mb-8">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-lg font-bold">Global Purpose Aggregation</h3>
                                <p className="text-sm text-muted-foreground">Total collections across all chapters vs association goals</p>
                            </div>
                            <BarChart size={24} className="text-primary" />
                        </div>
                        <div className="h-[350px] w-full">
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ReBarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--foreground), 0.1)" />
                                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `XAF ${val.toLocaleString()}`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                                        />
                                        <Bar dataKey="Collected" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={30} />
                                        <Bar dataKey="Expected" fill="rgba(var(--primary), 0.2)" radius={[4, 4, 0, 0]} barSize={30} />
                                    </ReBarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground italic">
                                    Strategic data loading...
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { title: 'Global Purpose Realization', desc: 'Aggregated progress across all chapters for association-wide purposes.', icon: PieChart },
                    { title: 'Chapter Performance Audit', desc: 'Comparative status of contribution levels across all association chapters.', icon: Building2 },
                    { title: 'National Handover History', desc: 'Complete log of funds handed over from National FS to National Treasurer.', icon: History },
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
