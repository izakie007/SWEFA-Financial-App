import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import { BarChart3, CheckCircle2, Landmark, ArrowRightLeft, FileSpreadsheet, Loader2, Plus } from 'lucide-react';
import { Card, CardContent, Table, TableHeader, TableRow, TableHeaderCell, TableCell } from '../../../components/ui/DataDisplay';
import { Button } from '../../../components/ui/Button';
import { Combobox } from '../../../components/ui/Combobox';
import { formatCurrency } from '../../../lib/formatters';
import { useState } from 'react';

const navItems = [
    { label: 'Dashboard', path: '/chapter/treasurer', icon: BarChart3 },
    { label: 'Reconciliation', path: '/chapter/treasurer/reconciliation', icon: CheckCircle2 },
    { label: 'Bank Transactions', path: '/chapter/treasurer/bank', icon: Landmark },
    { label: 'Forward to National', path: '/chapter/treasurer/forward', icon: ArrowRightLeft },
    { label: 'Reports', path: '/chapter/treasurer/reports', icon: FileSpreadsheet },
];

const receiptSchema = z.object({
    purpose_id: z.string().uuid('Please select a purpose'),
    amount_received: z.number().min(1, 'Amount must be greater than 0'),
});

type ReceiptFormValues = z.infer<typeof receiptSchema>;

export default function Reconciliation() {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const [success, setSuccess] = useState(false);

    // Fetch purposes
    const { data: purposes } = useQuery({
        queryKey: ['purposes'],
        queryFn: async () => {
            const { data, error } = await supabase.from('purposes').select('id, name').eq('is_active', true);
            if (error) throw error;
            return data?.map(p => ({ id: p.id, label: p.name || 'Unknown Purpose' })) || [];
        },
    });

    // Fetch pending handovers from FS (entries in fs_to_chapter_treasurer)
    const { data: pendingHandovers, isLoading: hLoading } = useQuery({
        queryKey: ['fs-handovers-for-treasurer', profile?.chapter_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('fs_to_chapter_treasurer')
                .select('id, amount, handed_over_at, purposes(name)')
                .eq('chapter_id', profile?.chapter_id)
                .order('handed_over_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!profile?.chapter_id,
    });

    const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<ReceiptFormValues>({
        resolver: zodResolver(receiptSchema),
    });

    const mutation = useMutation({
        mutationFn: async (values: ReceiptFormValues) => {
            const { error } = await supabase.from('chapter_treasurer_receipts').insert({
                ...values,
                chapter_id: profile?.chapter_id,
                received_by: profile?.user_id,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            setSuccess(true);
            reset();
            queryClient.invalidateQueries({ queryKey: ['chapter-reconciliation'] });
            setTimeout(() => setSuccess(false), 5000);
        },
    });

    const onSubmit = (data: ReceiptFormValues) => mutation.mutate(data);

    return (
        <DashboardLayout navItems={navItems} title="Reconciliation & Receipts">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1 h-fit bg-surface">
                    <CardContent className="p-8">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Plus size={20} className="text-primary" />
                            Record Receipt
                        </h3>
                        {success && (
                            <div className="mb-6 p-4 bg-secondary/10 text-secondary rounded-xl text-sm font-semibold animate-fade-in text-center">
                                Receipt recorded successfully!
                            </div>
                        )}
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <div className="space-y-4">
                                <Controller
                                    name="purpose_id"
                                    control={control}
                                    render={({ field }) => (
                                        <Combobox
                                            label="Purpose"
                                            placeholder="Narrow suggestions..."
                                            options={purposes || []}
                                            value={field.value}
                                            onChange={field.onChange}
                                            error={errors.purpose_id?.message}
                                        />
                                    )}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Amount Actually Received (XAF)</label>
                                <input
                                    type="number"
                                    {...register('amount_received', { valueAsNumber: true })}
                                    className="w-full p-4 rounded-xl bg-background-alt border border-border outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g. 50000"
                                />
                                {errors.amount_received && <p className="text-destructive text-xs">{errors.amount_received.message}</p>}
                            </div>
                            <Button type="submit" className="w-full py-4 text-lg" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : 'Confirm Receipt'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <div className="p-6 border-b border-border flex items-center justify-between">
                        <h3 className="font-bold">Handovers Stated by Financial Secretary</h3>
                    </div>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Handed Over At</TableHeaderCell>
                                    <TableHeaderCell>Purpose</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Stated Amount</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <tbody>
                                {hLoading ? (
                                    [1, 2, 3].map(i => <TableRow key={i}><TableCell colSpan={3} className="p-8 text-center animate-pulse">Loading...</TableCell></TableRow>)
                                ) : pendingHandovers?.map((item: any) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="text-muted-foreground">{new Date(item.handed_over_at).toLocaleString()}</TableCell>
                                        <TableCell className="font-semibold">{item.purposes?.name}</TableCell>
                                        <TableCell className="text-right font-black text-primary">
                                            {formatCurrency(item.amount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </tbody>
                        </Table>
                        {!hLoading && !pendingHandovers?.length && (
                            <div className="p-12 text-center text-muted-foreground font-medium">
                                No handovers currently pending from Financial Secretary.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
