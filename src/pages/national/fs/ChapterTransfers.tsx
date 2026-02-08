import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import {
    BarChart3,
    Building2,
    History,
    FileText,
    Search,
    Check,
    X
} from 'lucide-react';
import { Card, CardContent, Table, TableHeader, TableRow, TableHeaderCell, TableCell } from '../../../components/ui/DataDisplay';
import { Button } from '../../../components/ui/Button';
import { useState } from 'react';

const navItems = [
    { label: 'Dashboard', path: '/national/fs', icon: BarChart3 },
    { label: 'Chapter Transfers', path: '/national/fs/transfers', icon: Building2 },
    { label: 'Handover', path: '/national/fs/handover', icon: History },
    { label: 'Reports', path: '/national/fs/reports', icon: FileText },
];

export default function ChapterTransfers() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');

    const { data: transfers, isLoading } = useQuery({
        queryKey: ['national-chapter-transfers'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('chapter_to_national_transfers')
                .select('*, chapters(name), purposes(name)')
                .order('transfer_date', { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    const confirmMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('chapter_to_national_transfers')
                .update({ status: 'CONFIRMED' })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['national-chapter-transfers'] });
        },
    });

    return (
        <DashboardLayout navItems={navItems} title="Chapter Transfer Verification">
            <Card>
                <CardContent className="p-0">
                    <div className="p-6 border-b border-border flex items-center justify-between gap-4">
                        <h3 className="font-bold">Pending and Recent Transfers</h3>
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <input
                                type="text"
                                placeholder="Search chapter..."
                                className="w-full pl-10 pr-4 py-2 bg-background-alt border border-border rounded-xl outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeaderCell>Date</TableHeaderCell>
                                <TableHeaderCell>Chapter</TableHeaderCell>
                                <TableHeaderCell>Purpose</TableHeaderCell>
                                <TableHeaderCell>Ref #</TableHeaderCell>
                                <TableHeaderCell>Amount</TableHeaderCell>
                                <TableHeaderCell className="text-right">Action</TableHeaderCell>
                            </TableRow>
                        </TableHeader>
                        <tbody>
                            {isLoading ? (
                                [1, 2, 3].map(i => <TableRow key={i}><TableCell colSpan={6} className="p-8 text-center animate-pulse">Loading...</TableCell></TableRow>)
                            ) : transfers?.map((t: any) => (
                                <TableRow key={t.id}>
                                    <TableCell className="text-muted-foreground">{new Date(t.transfer_date).toLocaleDateString()}</TableCell>
                                    <TableCell className="font-bold">{t.chapters?.name}</TableCell>
                                    <TableCell>
                                        <span className="text-xs px-2 py-1 bg-muted rounded font-medium">{t.purposes?.name}</span>
                                    </TableCell>
                                    <TableCell className="text-xs font-mono">{t.reference_number}</TableCell>
                                    <TableCell className="font-black text-primary">
                                        {new Intl.NumberFormat('en-CM').format(t.amount)} FCFA
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {t.status === 'PENDING' ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-secondary hover:bg-secondary/10"
                                                    onClick={() => confirmMutation.mutate(t.id)}
                                                >
                                                    <Check size={18} />
                                                </Button>
                                                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10">
                                                    <X size={18} />
                                                </Button>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-black uppercase text-secondary">Confirmed</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </tbody>
                    </Table>
                    {!isLoading && !transfers?.length && (
                        <div className="p-12 text-center text-muted-foreground">No transfers recorded yet.</div>
                    )}
                </CardContent>
            </Card>
        </DashboardLayout>
    );
}
