import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import { LayoutDashboard, Users, HandCoins, History, FileText, Search, Download, UserPlus } from 'lucide-react';
import { Card, CardContent, Table, TableHeader, TableRow, TableHeaderCell, TableCell } from '../../../components/ui/DataDisplay';
import { Button } from '../../../components/ui/Button';
import { formatCurrency } from '../../../lib/formatters';
import { exportToCSV } from '../../../lib/export';
import { useState } from 'react';

const navItems = [
    { label: 'Dashboard', path: '/chapter/fs', icon: LayoutDashboard },
    { label: 'Member Ledger', path: '/chapter/fs/ledger', icon: Users },
    { label: 'Member Register', path: '/chapter/fs/members', icon: Users },
    { label: 'Record Transaction', path: '/chapter/fs/record', icon: HandCoins },
    { label: 'Handover', path: '/chapter/fs/handover', icon: History },
    { label: 'Reports', path: '/chapter/fs/reports', icon: FileText },
];

export default function MemberLedger() {
    const { profile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPurpose, setFilterPurpose] = useState('ALL');

    const { data: records, isLoading } = useQuery({
        queryKey: ['member-transactions', profile?.chapter_id, searchTerm, filterPurpose],
        queryFn: async () => {
            let query = supabase
                .from('member_transactions')
                .select(`
          id,
          amount,
          transaction_date,
          transaction_type,
          destination,
          members (full_name, membership_number),
          purposes (name)
        `)
                .eq('chapter_id', profile?.chapter_id)
                .order('transaction_date', { ascending: false });

            if (searchTerm) {
                // Approximate search logic
            }
            if (filterPurpose !== 'ALL') {
                query = query.eq('purpose_id', filterPurpose);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
        enabled: !!profile?.chapter_id,
    });

    const handleExport = () => {
        if (!records) return;
        const exportData = records.map((r: any) => ({
            date: r.transaction_date,
            member: r.members?.full_name,
            purpose: r.purposes?.name,
            amount: r.amount,
            type: r.transaction_type,
            destination: r.destination
        }));
        exportToCSV(exportData, 'member_ledger', ['Date', 'Member', 'Purpose', 'Amount', 'Type', 'Destination']);
    };

    return (
        <DashboardLayout
            navItems={navItems}
            title="Member Ledger"
        >
            <Card>
                <CardContent className="p-0">
                    <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search member name..."
                                className="w-full pl-10 pr-4 py-2 rounded-xl bg-background-alt border border-border outline-none focus:ring-2 focus:ring-primary/20"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                className="p-2 rounded-xl bg-background-alt border border-border text-sm outline-none"
                                value={filterPurpose}
                                onChange={(e) => setFilterPurpose(e.target.value)}
                            >
                                <option value="ALL">All Purposes</option>
                                {/* We could fetch purposes here, but for now fixed list or leave as is */}
                            </select>
                            <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
                                <Download size={16} />
                                Export CSV
                            </Button>
                            <Button size="sm" className="gap-2">
                                <UserPlus size={16} />
                                Add Record
                            </Button>
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeaderCell>Date</TableHeaderCell>
                                <TableHeaderCell>Member</TableHeaderCell>
                                <TableHeaderCell>Purpose</TableHeaderCell>
                                <TableHeaderCell>Amount</TableHeaderCell>
                                <TableHeaderCell>Type</TableHeaderCell>
                                <TableHeaderCell>Destination</TableHeaderCell>
                                <TableHeaderCell className="text-right">Action</TableHeaderCell>
                            </TableRow>
                        </TableHeader>
                        <tbody>
                            {isLoading ? (
                                [1, 2, 3, 4, 5].map((i) => (
                                    <TableRow key={i}>
                                        {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                                            <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-20" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : records?.map((record: any) => (
                                <TableRow key={record.id}>
                                    <TableCell className="font-medium text-muted-foreground">
                                        {new Date(record.transaction_date).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-semibold">{record.members?.full_name}</div>
                                        <div className="text-[10px] text-muted-foreground">{record.members?.membership_number || 'No ID'}</div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold uppercase tracking-tight">
                                            {record.purposes?.name}
                                        </span>
                                    </TableCell>
                                    <TableCell className="font-bold">
                                        {formatCurrency(record.amount)}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${record.transaction_type === 'COLLECTION' ? 'bg-secondary/10 text-secondary' : 'bg-destructive/10 text-destructive'
                                            }`}>
                                            {record.transaction_type}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs font-medium text-muted-foreground">{record.destination}</span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm">Details</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </tbody>
                    </Table>

                    {!isLoading && !records?.length && (
                        <div className="p-12 text-center text-muted-foreground">
                            No records found for the given criteria.
                        </div>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
