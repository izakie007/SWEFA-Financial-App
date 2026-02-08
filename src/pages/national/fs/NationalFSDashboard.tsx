import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import {
    BarChart3,
    Globe,
    Building2,
    TrendingUp,
    History,
    FileText,
    Users
} from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/DataDisplay';
import { formatCurrency } from '../../../lib/formatters';

const navItems = [
    { label: 'Dashboard', path: '/national/fs', icon: BarChart3 },
    { label: 'Chapter Transfers', path: '/national/fs/transfers', icon: Building2 },
    { label: 'Handover', path: '/national/fs/handover', icon: History },
    { label: 'Member Ledger', path: '/national/fs/ledger', icon: Users },
    { label: 'Reports', path: '/national/fs/reports', icon: FileText },
];

export default function NationalFSDashboard() {
    // Aggregate data for national side
    const { data: summary, isLoading } = useQuery({
        queryKey: ['national-summary'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('v_national_purpose_summary')
                .select('*');
            if (error) throw error;
            return data;
        },
    });

    return (
        <DashboardLayout navItems={navItems} title="National Financial Overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-primary text-white col-span-1 md:col-span-1">
                    <CardContent className="p-8">
                        <Globe size={48} className="opacity-20 absolute top-4 right-4" />
                        <p className="text-sm font-medium uppercase opacity-80">Total National Collection</p>
                        <p className="text-4xl font-black mt-2">
                            {formatCurrency(summary?.reduce((acc: number, item: any) => acc + item.total_collected, 0) || 0)}
                        </p>
                        <p className="text-xs opacity-60 mt-4">Aggregated from all active chapters</p>
                    </CardContent>
                </Card>

                <Card className="col-span-1 md:col-span-2">
                    <CardContent className="p-8">
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            <TrendingUp size={20} className="text-secondary" />
                            Purpose-wise Performance
                        </h3>
                        <div className="space-y-4">
                            {summary?.map((purpose: any) => (
                                <div key={purpose.purpose_id} className="space-y-1">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span>{purpose.purpose_name}</span>
                                        <span className="font-bold">{formatCurrency(purpose.total_collected)}</span>
                                    </div>
                                    <div className="w-full h-2 bg-muted rounded-full">
                                        <div
                                            className="h-full bg-secondary rounded-full"
                                            style={{ width: `${Math.min(100, (purpose.total_collected / (purpose.total_expected || 1)) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                            {isLoading && <div className="p-4 text-center animate-pulse">Loading summary...</div>}
                            {!isLoading && !summary?.length && <div className="p-4 text-center text-muted-foreground">No national data available.</div>}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-8">
                <Card>
                    <div className="p-6 border-b border-border flex items-center justify-between">
                        <h3 className="font-bold">Chapter Wise Status</h3>
                    </div>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-background-alt text-[10px] font-black uppercase text-muted-foreground">
                                    <tr>
                                        <th className="px-6 py-4">Chapter Name</th>
                                        <th className="px-6 py-4">Members</th>
                                        <th className="px-6 py-4">Collected</th>
                                        <th className="px-6 py-4">Transfer Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {/* Mock for now as we don't have a direct view for this specific join yet */}
                                    {[1, 2, 3].map(i => (
                                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4 font-bold">Chapter {i === 1 ? 'Victoria' : i === 2 ? 'Kumba' : 'Buea'}</td>
                                            <td className="px-6 py-4 text-muted-foreground">{10 * i} Active Members</td>
                                            <td className="px-6 py-4 font-semibold">{formatCurrency(250000 * i)}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-secondary/10 text-secondary text-[10px] font-black rounded uppercase">
                                                    Up to date
                                                </span>
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
