import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import {
    BarChart3,
    Building2,
    History,
    FileText,
    Loader2,
    Users
} from 'lucide-react';
import { Card, CardContent, Table, TableHeader, TableRow, TableHeaderCell, TableCell } from '../../../components/ui/DataDisplay';
import { Button } from '../../../components/ui/Button';
import { Combobox } from '../../../components/ui/Combobox';
import { formatCurrency } from '../../../lib/formatters';
import { useState } from 'react';

const navItems = [
    { label: 'Dashboard', path: '/national/fs', icon: BarChart3 },
    { label: 'Chapter Transfers', path: '/national/fs/transfers', icon: Building2 },
    { label: 'Handover', path: '/national/fs/handover', icon: History },
    { label: 'Member Ledger', path: '/national/fs/ledger', icon: Users },
    { label: 'Reports', path: '/national/fs/reports', icon: FileText },
];

const handoverSchema = z.object({
    purpose_id: z.string().uuid('Please select a purpose'),
    amount: z.number().min(1, 'Amount must be greater than 0'),
});

type HandoverFormValues = z.infer<typeof handoverSchema>;

export default function NationalHandover() {
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
        queryKey: ['national-fs-handovers'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('fs_to_national_treasurer')
                .select('id, amount, handed_over_at, purposes(name)')
                .order('handed_over_at', { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<HandoverFormValues>({
        resolver: zodResolver(handoverSchema),
    });

    const mutation = useMutation({
        mutationFn: async (values: HandoverFormValues) => {
            const { error } = await supabase.from('fs_to_national_treasurer').insert({
                ...values,
                handed_over_by: profile?.user_id,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            setSuccess(true);
            reset();
            queryClient.invalidateQueries({ queryKey: ['national-fs-handovers'] });
            setTimeout(() => setSuccess(false), 5000);
        },
    });

    const onSubmit = (data: HandoverFormValues) => mutation.mutate(data);

    return (
        <DashboardLayout navItems={navItems} title="Handover to National Treasurer">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1 h-fit">
                    <CardContent className="p-8">
                        <h3 className="text-xl font-bold mb-6">New Handover</h3>
                        {success && (
                            <div className="mb-6 p-4 bg-secondary/10 text-secondary rounded-xl text-center font-bold text-sm">
                                National handover recorded!
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
                                <label className="text-sm font-medium">Amount to Hand Over (XAF)</label>
                                <input
                                    type="number"
                                    {...register('amount', { valueAsNumber: true })}
                                    className="w-full p-4 rounded-xl bg-background-alt border border-border focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="FCFA amount"
                                />
                                {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
                            </div>
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : 'Record Handover'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <CardContent className="p-0">
                        <div className="p-6 border-b border-border">
                            <h3 className="font-bold">National Handover History</h3>
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Date</TableHeaderCell>
                                    <TableHeaderCell>Purpose</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <tbody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={3} className="p-8 text-center animate-pulse">Loading...</TableCell></TableRow>
                                ) : history?.map((item: any) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="text-muted-foreground">{new Date(item.handed_over_at).toLocaleString()}</TableCell>
                                        <TableCell className="font-bold">{item.purposes?.name}</TableCell>
                                        <TableCell className="text-right font-black text-secondary">
                                            {formatCurrency(item.amount)}
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
