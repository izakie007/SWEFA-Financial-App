import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import { LayoutDashboard, Users, HandCoins, History, FileText, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/DataDisplay';
import { Button } from '../../../components/ui/Button';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../../lib/formatters';

const navItems = [
    { label: 'Dashboard', path: '/chapter/fs', icon: LayoutDashboard },
    { label: 'Member Ledger', path: '/chapter/fs/ledger', icon: Users },
    { label: 'Member Register', path: '/chapter/fs/members', icon: Users },
    { label: 'Record Transaction', path: '/chapter/fs/record', icon: HandCoins },
    { label: 'Handover', path: '/chapter/fs/handover', icon: History },
    { label: 'Reports', path: '/chapter/fs/reports', icon: FileText },
];

export default function ChapterFSDashboard() {
    const { profile } = useAuth();

    const { data: summary, isLoading } = useQuery({
        queryKey: ['chapter-summary', profile?.chapter_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('v_chapter_purpose_summary')
                .select('*')
                .eq('chapter_id', profile?.chapter_id);
            if (error) throw error;
            return data;
        },
        enabled: !!profile?.chapter_id,
    });

    const { data: pendingData } = useQuery({
        queryKey: ['chapter-pending', profile?.chapter_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('v_members_pending_contributions')
                .select('*')
                .eq('chapter_id', profile?.chapter_id)
                .limit(5);
            if (error) throw error;
            return data;
        },
        enabled: !!profile?.chapter_id,
    });

    return (
        <DashboardLayout navItems={navItems} title="Financial Overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {isLoading ? (
                    [1, 2, 3].map((i) => (
                        <div key={i} className="h-32 bg-muted animate-pulse rounded-3xl" />
                    ))
                ) : summary?.length ? (
                    summary.map((item: any) => (
                        <Card key={item.purpose_id} className="relative group overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <TrendingUp size={64} />
                            </div>
                            <CardContent className="p-6">
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{item.purpose_name}</p>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-foreground">
                                        {formatCurrency(item.total_collected)}
                                    </span>
                                </div>
                                <div className="mt-4 flex flex-col gap-1">
                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-1000"
                                            style={{ width: `${Math.min(100, (item.total_collected / item.total_expected) * 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                                        <span>{item.contributors} Contributors</span>
                                        <span>{Math.round((item.total_collected / item.total_expected) * 100)}% of Target</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <div className="md:col-span-3 text-center py-12 bg-surface rounded-3xl border border-dashed border-border">
                        <p className="text-muted-foreground">No transaction data available for your chapter yet.</p>
                        <Button variant="outline" className="mt-4" onClick={() => { }}>Start Recording</Button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
                <Card>
                    <div className="p-6 border-b border-border flex items-center justify-between">
                        <h3 className="font-bold flex items-center gap-2">
                            <AlertCircle size={18} className="text-accent" />
                            Pending Contributions
                        </h3>
                        <Link to="/chapter/fs/reports">
                            <Button variant="ghost" size="sm" className="text-primary">View Report</Button>
                        </Link>
                    </div>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {pendingData?.length ? (
                                pendingData.map((item: any) => (
                                    <div key={`${item.member_id}-${item.purpose_id}`} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                        <div>
                                            <p className="font-medium">{item.full_name}</p>
                                            <p className="text-xs text-muted-foreground">{item.purpose_name}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-destructive">{formatCurrency(item.balance)}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Unpaid</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-12 text-center text-muted-foreground italic">
                                    No pending contributions found.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-primary text-white">
                    <CardContent className="p-8 h-full flex flex-col justify-between space-y-8">
                        <div>
                            <h3 className="text-xl font-bold opacity-90 italic">South West Ex-Footballers Association</h3>
                            <p className="text-4xl font-black mt-4 tracking-tighter">Transparency in Unity</p>
                        </div>
                        <div className="space-y-4">
                            <p className="text-sm opacity-80 max-w-xs">
                                Accurate recording of every member's contribution ensures the strength of our association.
                            </p>
                            <Button variant="secondary" className="bg-white text-primary hover:bg-white/90">
                                Generate Monthly Report
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
