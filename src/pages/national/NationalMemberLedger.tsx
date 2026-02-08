import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Users, Building2, History, FileText, Search, Download, Landmark, BarChart3, ShieldCheck, FileStack } from 'lucide-react';
import { Card, CardContent, Table, TableHeader, TableRow, TableHeaderCell, TableCell } from '../../components/ui/DataDisplay';
import { Button } from '../../components/ui/Button';
import { exportToCSV } from '../../lib/export';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function NationalMemberLedger() {
    const { profile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterChapter, setFilterChapter] = useState('ALL');

    // Navigation items change based on the role
    const isNationalFS = profile?.role_code === 'NATIONAL_FS';

    const navItems = isNationalFS ? [
        { label: 'Dashboard', path: '/national/fs', icon: BarChart3 },
        { label: 'Chapter Transfers', path: '/national/fs/transfers', icon: Building2 },
        { label: 'Handover', path: '/national/fs/handover', icon: History },
        { label: 'Member Ledger', path: '/national/fs/ledger', icon: Users },
        { label: 'Reports', path: '/national/fs/reports', icon: FileText },
    ] : [
        { label: 'Dashboard', path: '/national/treasurer', icon: BarChart3 },
        { label: 'NT Reconciliation', path: '/national/treasurer/reconciliation', icon: ShieldCheck },
        { label: 'National Bank', path: '/national/treasurer/bank', icon: Landmark },
        { label: 'Member Ledger', path: '/national/treasurer/ledger', icon: Users },
        { label: 'Global Reports', path: '/national/treasurer/reports', icon: FileStack },
    ];

    const { data: chapters } = useQuery({
        queryKey: ['chapters'],
        queryFn: async () => {
            const { data, error } = await supabase.from('chapters').select('id, name').order('name');
            if (error) throw error;
            return data;
        },
    });

    const { data: members, isLoading } = useQuery({
        queryKey: ['national-members', searchTerm, filterChapter],
        queryFn: async () => {
            let query = supabase
                .from('members')
                .select(`
                    id,
                    full_name,
                    membership_number,
                    phone_number,
                    membership_year,
                    chapters (name)
                `)
                .eq('is_active', true)
                .order('full_name');

            if (filterChapter !== 'ALL') {
                query = query.eq('chapter_id', filterChapter);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (searchTerm) {
                return data.filter(m =>
                    m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    m.membership_number?.toLowerCase().includes(searchTerm.toLowerCase())
                );
            }

            return data;
        },
    });

    const handleExport = () => {
        if (!members) return;
        const exportData = members.map((m: any) => ({
            name: m.full_name,
            id_number: m.membership_number,
            chapter: m.chapters?.name,
            phone: m.phone_number,
            year: m.membership_year
        }));
        exportToCSV(exportData, 'national_member_register', ['Name', 'Id Number', 'Chapter', 'Phone', 'Year']);
    };

    return (
        <DashboardLayout navItems={navItems} title="Global Member Register">
            <Card>
                <CardContent className="p-0">
                    <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-1 gap-4 max-w-2xl">
                            <div className="relative flex-1">
                                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search by name or ID..."
                                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-background-alt border border-border outline-none focus:ring-2 focus:ring-primary/20"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <select
                                className="p-2 rounded-xl bg-background-alt border border-border text-sm outline-none"
                                value={filterChapter}
                                onChange={(e) => setFilterChapter(e.target.value)}
                            >
                                <option value="ALL">All Chapters</option>
                                {chapters?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
                            <Download size={16} />
                            Export CSV
                        </Button>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeaderCell>Full Name</TableHeaderCell>
                                <TableHeaderCell>Chapter</TableHeaderCell>
                                <TableHeaderCell>ID / Membership #</TableHeaderCell>
                                <TableHeaderCell>Phone</TableHeaderCell>
                                <TableHeaderCell>Join Year</TableHeaderCell>
                            </TableRow>
                        </TableHeader>
                        <tbody>
                            {isLoading ? (
                                [1, 2, 3, 4, 5].map((i) => (
                                    <TableRow key={i}>
                                        {[1, 2, 3, 4, 5].map((j) => (
                                            <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-24" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : members?.map((member: any) => (
                                <TableRow key={member.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-bold text-foreground">{member.full_name}</TableCell>
                                    <TableCell>
                                        <span className="px-2 py-1 rounded bg-primary/10 text-primary text-[10px] font-black uppercase">
                                            {member.chapters?.name}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-xs">{member.membership_number}</TableCell>
                                    <TableCell className="text-muted-foreground">{member.phone_number || 'N/A'}</TableCell>
                                    <TableCell className="text-muted-foreground">{member.membership_year || member.created_at?.split('-')[0]}</TableCell>
                                </TableRow>
                            ))}
                        </tbody>
                    </Table>

                    {!isLoading && !members?.length && (
                        <div className="p-20 text-center text-muted-foreground">
                            No members found across the association.
                        </div>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
