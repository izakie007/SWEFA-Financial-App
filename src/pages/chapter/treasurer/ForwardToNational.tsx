import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import {
    BarChart3,
    CheckCircle2,
    Landmark,
    ArrowRightLeft,
    FileSpreadsheet,
    Loader2,
    Send
} from 'lucide-react';
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

const forwardSchema = z.object({
    purpose_id: z.string().uuid('Please select a purpose'),
    amount: z.number().min(1, 'Amount must be greater than 0'),
    reference_number: z.string().min(1, 'Reference number is required'),
    transfer_date: z.string(),
});

type ForwardFormValues = z.infer<typeof forwardSchema>;

export default function ForwardToNational() {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const [success, setSuccess] = useState(false);

    // Fetch purposes (only National level ones usually, but let's fetch all active)
    const { data: purposes } = useQuery({
        queryKey: ['purposes'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('purposes')
                .select('id, name')
                .eq('is_active', true)
                .eq('level', 'NATIONAL');
            if (error) throw error;
            return data?.map(p => ({ id: p.id, label: p.name })) || [];
        },
    });

    // Fetch recent transfers
    const { data: transfers, isLoading } = useQuery({
        queryKey: ['chapter-to-national-transfers', profile?.chapter_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('chapter_to_national_transfers')
                .select('id, amount, transfer_date, reference_number, status, purposes(name)')
                .eq('chapter_id', profile?.chapter_id)
                .order('transfer_date', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!profile?.chapter_id,
    });

    const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<ForwardFormValues>({
        resolver: zodResolver(forwardSchema),
        defaultValues: {
            transfer_date: new Date().toISOString().split('T')[0],
        }
    });

    const mutation = useMutation({
        mutationFn: async (values: ForwardFormValues) => {
            const { error } = await supabase.from('chapter_to_national_transfers').insert({
                ...values,
                chapter_id: profile?.chapter_id,
                initiated_by: profile?.user_id,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            setSuccess(true);
            reset();
            queryClient.invalidateQueries({ queryKey: ['chapter-to-national-transfers'] });
            setTimeout(() => setSuccess(false), 5000);
        },
    });

    const onSubmit = (data: ForwardFormValues) => mutation.mutate(data);

    return (
        <DashboardLayout navItems={navItems} title="Forward to National">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1 h-fit">
                    <CardContent className="p-8">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Send size={20} className="text-primary" />
                            New Transfer
                        </h3>
                        {success && (
                            <div className="mb-6 p-4 bg-secondary/10 text-secondary rounded-xl text-sm font-semibold text-center">
                                Transfer recorded successfully!
                            </div>
                        )}
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <div className="space-y-4">
                                <Controller
                                    name="purpose_id"
                                    control={control}
                                    render={({ field }) => (
                                        <Combobox
                                            label="National Purpose"
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
                                <label className="text-sm font-medium">Amount to Forward (XAF)</label>
                                <input
                                    type="number"
                                    {...register('amount', { valueAsNumber: true })}
                                    className="w-full p-4 rounded-xl bg-background-alt border border-border focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="e.g. 250000"
                                />
                                {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Bank Reference / Slip #</label>
                                <input
                                    type="text"
                                    {...register('reference_number')}
                                    className="w-full p-4 rounded-xl bg-background-alt border border-border focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="Reference number"
                                />
                                {errors.reference_number && <p className="text-destructive text-xs">{errors.reference_number.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Transfer Date</label>
                                <input
                                    type="date"
                                    {...register('transfer_date')}
                                    className="w-full p-4 rounded-xl bg-background-alt border border-border focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : 'Initiate Forwarding'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <div className="p-6 border-b border-border">
                        <h3 className="font-bold">Recent National Transfers</h3>
                    </div>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Date</TableHeaderCell>
                                    <TableHeaderCell>Purpose</TableHeaderCell>
                                    <TableHeaderCell>Reference</TableHeaderCell>
                                    <TableHeaderCell>Amount</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Status</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <tbody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={5} className="p-12 text-center animate-pulse">Loading history...</TableCell></TableRow>
                                ) : transfers?.map((t: any) => (
                                    <TableRow key={t.id}>
                                        <TableCell className="text-muted-foreground">{new Date(t.transfer_date).toLocaleDateString()}</TableCell>
                                        <TableCell className="font-bold">{t.purposes?.name}</TableCell>
                                        <TableCell className="text-xs">{t.reference_number}</TableCell>
                                        <TableCell className="font-black text-primary">
                                            {formatCurrency(t.amount)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${t.status === 'CONFIRMED' ? 'bg-secondary/10 text-secondary' : 'bg-accent/10 text-accent'
                                                }`}>
                                                {t.status}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </tbody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
