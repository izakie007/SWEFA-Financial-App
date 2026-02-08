import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import { LayoutDashboard, Users, HandCoins, History, FileText, AlertCircle, Search } from 'lucide-react';
import { Card, CardContent, Table, TableHeader, TableRow, TableHeaderCell, TableCell } from '../../../components/ui/DataDisplay';
import { Button } from '../../../components/ui/Button';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

const navItems = [
    { label: 'Dashboard', path: '/chapter/fs', icon: LayoutDashboard },
    { label: 'Member Ledger', path: '/chapter/fs/ledger', icon: Users },
    { label: 'Record Transaction', path: '/chapter/fs/record', icon: HandCoins },
    { label: 'Handover', path: '/chapter/fs/handover', icon: History },
    { label: 'Reports', path: '/chapter/fs/reports', icon: FileText },
];

export default function PendingContributions() {
    const { profile } = useAuth();
    const { purposeId } = useParams();
    const [searchTerm, setSearchTerm] = useState('');

    const { data: pending, isLoading } = useQuery({
        queryKey: ['pending-contributions', profile?.chapter_id, purposeId],
        queryFn: async () => {
            let query = supabase
                .from('v_members_pending_contributions')
                .select('*')
                .eq('chapter_id', profile?.chapter_id);

            if (purposeId && purposeId !== 'all') {
                query = query.eq('purpose_id', purposeId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
        enabled: !!profile?.chapter_id,
    });

    return (
        <DashboardLayout navItems={navItems} title="Pending Contributions">
            <Card>
                <CardContent className="p-0">
                    <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h3 className="font-bold flex items-center gap-2">
                            <AlertCircle size={20} className="text-accent" />
                            Members Yet to Contribute
                        </h3>
                        <div className="relative flex-1 max-w-sm">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search member..."
                                className="w-full pl-10 pr-4 py-2 rounded-xl bg-background-alt border border-border outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeaderCell>Member Name</TableHeaderCell>
                                <TableHeaderCell>Purpose</TableHeaderCell>
                                <TableHeaderCell>Expected</TableHeaderCell>
                                <TableHeaderCell>Paid</TableHeaderCell>
                                <TableHeaderCell>Balance</TableHeaderCell>
                                <TableHeaderCell className="text-right">Action</TableHeaderCell>
                            </TableRow>
                        </TableHeader>
                        <tbody>
                            {isLoading ? (
                                [1, 2, 3].map(i => (
                                    <TableRow key={i}>
                                        {[1, 2, 3, 4, 5, 6].map(j => (
                                            <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-20" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : pending?.map((item: any) => (
                                <TableRow key={`${item.member_id}-${item.purpose_id}`}>
                                    <TableCell className="font-semibold">{item.full_name}</TableCell>
                                    <TableCell>
                                        <span className="text-xs font-medium px-2 py-1 bg-muted rounded">
                                            {item.purpose_name}
                                        </span>
                                    </TableCell>
                                    <TableCell>{new Intl.NumberFormat('en-CM').format(item.expected_amount)} FCFA</TableCell>
                                    <TableCell className="text-secondary font-medium">{new Intl.NumberFormat('en-CM').format(item.amount_paid)} FCFA</TableCell>
                                    <TableCell className="text-destructive font-bold">{new Intl.NumberFormat('en-CM').format(item.balance)} FCFA</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => { }}>Remind</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </tbody>
                    </Table>
                    {!isLoading && !pending?.length && (
                        <div className="p-12 text-center text-muted-foreground">
                            All members have contributed for this purpose!
                        </div>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
