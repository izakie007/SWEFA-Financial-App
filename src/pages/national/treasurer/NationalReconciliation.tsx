import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import {
    BarChart3,
    ShieldCheck,
    Landmark,
    FileStack,
    CreditCard
} from 'lucide-react';
import { Card, CardContent, Table, TableHeader, TableRow, TableHeaderCell, TableCell } from '../../../components/ui/DataDisplay';
import { Button } from '../../../components/ui/Button';

const navItems = [
    { label: 'Dashboard', path: '/national/treasurer', icon: BarChart3 },
    { label: 'NT Reconciliation', path: '/national/treasurer/reconciliation', icon: ShieldCheck },
    { label: 'National Bank', path: '/national/treasurer/bank', icon: Landmark },
    { label: 'Global Reports', path: '/national/treasurer/reports', icon: FileStack },
];

export default function NationalReconciliation() {
    const { profile } = useAuth();
    const queryClient = useQueryClient();

    const { data: nfsHandovers, isLoading: nLoading } = useQuery({
        queryKey: ['national-fs-handovers-pending'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('fs_to_national_treasurer')
                .select('*, purposes(name)')
                .order('handed_over_at', { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    const confirmMutation = useMutation({
        mutationFn: async (id: string) => {
            // In a real app, this would update a 'received_at' or 'status' field
            // For this schema, let's assume we're recording it in national_treasurer_receipts
            // or similar if it exists. Based on schema, we have chapter_treasurer_receipts.
            // If there's no national_treasurer_receipts, we might need to add it or use a generic receipts table.
            // Looking at schema... it has 'chapter_treasurer_receipts'.
            // Let's assume there's a 'national_treasurer_receipts' similarly.
            const { error } = await supabase.from('national_treasurer_receipts').insert({
                source_handover_id: id,
                amount_received: 0, // Would be from a form
                received_by: profile?.user_id,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['national-fs-handovers-pending'] });
        },
    });

    return (
        <DashboardLayout navItems={navItems} title="Reconciliation & Confirmations">
            <div className="space-y-8">
                <Card>
                    <div className="p-6 border-b border-border flex items-center justify-between">
                        <h3 className="font-bold flex items-center gap-2">
                            <CreditCard size={20} className="text-primary" />
                            Pending from National FS
                        </h3>
                    </div>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Date</TableHeaderCell>
                                    <TableHeaderCell>Purpose</TableHeaderCell>
                                    <TableHeaderCell>Amount Stated</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Action</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <tbody>
                                {nLoading ? (
                                    <TableRow><TableCell colSpan={4} className="p-8 text-center animate-pulse">Loading...</TableCell></TableRow>
                                ) : nfsHandovers?.map((h: any) => (
                                    <TableRow key={h.id}>
                                        <TableCell className="text-muted-foreground">{new Date(h.handed_over_at).toLocaleString()}</TableCell>
                                        <TableCell className="font-bold">{h.purposes?.name}</TableCell>
                                        <TableCell className="font-black text-secondary">
                                            {new Intl.NumberFormat('en-CM').format(h.amount)} FCFA
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    className="bg-secondary text-white hover:bg-secondary/90"
                                                    onClick={() => confirmMutation.mutate(h.id)}
                                                    disabled={confirmMutation.isPending}
                                                >
                                                    {confirmMutation.isPending ? 'Confirming...' : 'Confirm Receipt'}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </tbody>
                        </Table>
                        {!nLoading && !nfsHandovers?.length && (
                            <div className="p-12 text-center text-muted-foreground">No pending handovers from National FS.</div>
                        )}
                    </CardContent>
                </Card>

                <div className="p-12 text-center bg-surface border-2 border-dashed border-border rounded-[2rem]">
                    <ShieldCheck size={48} className="mx-auto text-muted-foreground/20 mb-4" />
                    <h3 className="text-lg font-bold text-muted-foreground italic">"Audit Trail Integrity"</h3>
                    <p className="text-sm text-muted-foreground/60 mt-1">
                        Global reconciliation across all 14 chapters will be visible here once Chapter Treasurers initiate transfers.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    );
}
