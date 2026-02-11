import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import { LayoutDashboard, Users, HandCoins, History, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, Table, TableHeader, TableRow, TableHeaderCell, TableCell } from '../../../components/ui/DataDisplay';
import { Button } from '../../../components/ui/Button';
import { Combobox } from '../../../components/ui/Combobox';
import { formatCurrency } from '../../../lib/formatters';
import { useState } from 'react';

const navItems = [
    { label: 'Dashboard', path: '/chapter/fs', icon: LayoutDashboard },
    { label: 'Member Ledger', path: '/chapter/fs/ledger', icon: Users },
    { label: 'Member Register', path: '/chapter/fs/members', icon: Users },
    { label: 'Record Transaction', path: '/chapter/fs/record', icon: HandCoins },
    { label: 'Handover', path: '/chapter/fs/handover', icon: History },
    { label: 'Reports', path: '/chapter/fs/reports', icon: FileText },
];

const handoverSchema = z.object({
    purpose_id: z.string().uuid('Please select a purpose'),
    amount: z.number().min(1, 'Amount must be greater than 0'),
});

type HandoverFormValues = z.infer<typeof handoverSchema>;

export default function FSHandover() {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const [success, setSuccess] = useState(false);

    // Fetch active purposes
    const { data: purposes } = useQuery({
        queryKey: ['purposes'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('purposes')
                .select('id, name')
                .eq('is_active', true);
            if (error) throw error;
            return data?.map(p => ({ id: p.id, label: p.name || 'Unknown Purpose' })) || [];
        },
    });

    // Fetch handover history
    const { data: history, isLoading } = useQuery({
        queryKey: ['fs-handovers', profile?.chapter_id],
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

    const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<HandoverFormValues>({
        resolver: zodResolver(handoverSchema),
    });

    const mutation = useMutation({
        mutationFn: async (values: HandoverFormValues) => {
            const { error } = await supabase.from('fs_to_chapter_treasurer').insert({
                ...values,
                chapter_id: profile?.chapter_id,
                handed_over_by: profile?.user_id,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            setSuccess(true);
            reset();
            queryClient.invalidateQueries({ queryKey: ['fs-handovers'] });
            setTimeout(() => setSuccess(false), 5000);
        },
    });

    const onSubmit = (data: HandoverFormValues) => mutation.mutate(data);

    return (
        <DashboardLayout navItems={navItems} title="Handover to Treasurer">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1 h-fit">
                    <CardContent className="p-8">
                        <h3 className="text-xl font-bold mb-6">New Handover</h3>
                        {success && (
                            <div className="mb-6 p-4 bg-secondary/10 text-secondary rounded-xl flex items-center gap-2 animate-fade-in">
                                <CheckCircle2 size={20} />
                                <span className="text-sm font-semibold">Handover recorded!</span>
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
                                            placeholder="Select purpose to hand over..."
                                            options={purposes || []}
                                            value={field.value}
                                            onChange={field.onChange}
                                            error={errors.purpose_id?.message}
                                        />
                                    )}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Amount Handed Over (XAF)</label>
                                <input
                                    type="number"
                                    {...register('amount', { valueAsNumber: true })}
                                    className="w-full p-4 rounded-xl bg-background-alt border border-border focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="e.g. 50000"
                                />
                                {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Record Handover'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardContent className="p-0">
                        <div className="p-6 border-b border-border">
                            <h3 className="font-bold">Recent Handovers</h3>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Date</TableHeaderCell>
                                    <TableHeaderCell>Purpose</TableHeaderCell>
                                    <TableHeaderCell>Amount</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Status</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <tbody>
                                {isLoading ? (
                                    [1, 2, 3].map(i => (
                                        <TableRow key={i}>
                                            {[1, 2, 3, 4].map(j => (
                                                <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-20" /></TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : history?.map((item: any) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="text-muted-foreground">
                                            {new Date(item.handed_over_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="font-semibold">{item.purposes?.name}</TableCell>
                                        <TableCell className="font-bold">{formatCurrency(item.amount)}</TableCell>
                                        <TableCell className="text-right">
                                            <span className="px-2 py-1 bg-muted text-muted-foreground text-[10px] font-bold rounded uppercase">
                                                Recorded
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </tbody>
                        </Table>
                        {!isLoading && !history?.length && (
                            <div className="p-12 text-center text-muted-foreground">
                                No handovers recorded yet.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
