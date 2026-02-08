import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import { LayoutDashboard, Users, HandCoins, History, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/DataDisplay';
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

const transactionSchema = z.object({
    member_id: z.string().uuid('Please select a member'),
    purpose_id: z.string().uuid('Please select a purpose'),
    amount: z.number().min(1, 'Amount must be greater than 0'),
    transaction_type: z.enum(['COLLECTION', 'DISBURSEMENT']),
    destination: z.enum(['CHAPTER', 'NATIONAL']),
    transaction_date: z.string(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

export default function RecordTransaction() {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const [success, setSuccess] = useState(false);

    // Fetch members of this chapter
    const { data: members } = useQuery({
        queryKey: ['members', profile?.chapter_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('members')
                .select('id, full_name, membership_number')
                .eq('chapter_id', profile?.chapter_id)
                .eq('is_active', true);
            if (error) throw error;
            return data?.map(m => ({ id: m.id, label: `${m.full_name} (${m.membership_number || 'N/A'})` })) || [];
        },
        enabled: !!profile?.chapter_id,
    });

    // Fetch active purposes
    const { data: purposes } = useQuery({
        queryKey: ['purposes'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('purposes')
                .select('id, name, level, expected_amount')
                .eq('is_active', true);
            if (error) throw error;
            return data?.map(p => ({
                id: p.id,
                label: `${p.name} ${p.expected_amount ? `(${formatCurrency(p.expected_amount)})` : ''}`
            })) || [];
        },
    });

    const { register, handleSubmit, reset, watch, control, formState: { errors, isSubmitting } } = useForm<TransactionFormValues>({
        resolver: zodResolver(transactionSchema),
        defaultValues: {
            transaction_type: 'COLLECTION',
            destination: 'CHAPTER',
            transaction_date: new Date().toISOString().split('T')[0],
        }
    });

    const mutation = useMutation({
        mutationFn: async (values: TransactionFormValues) => {
            const { error } = await supabase.from('member_transactions').insert({
                ...values,
                chapter_id: profile?.chapter_id,
                recorded_by: profile?.user_id,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            setSuccess(true);
            reset();
            queryClient.invalidateQueries({ queryKey: ['member-transactions'] });
            queryClient.invalidateQueries({ queryKey: ['chapter-summary'] });
            setTimeout(() => setSuccess(false), 5000);
        },
    });

    const onSubmit = (data: TransactionFormValues) => mutation.mutate(data);

    return (
        <DashboardLayout navItems={navItems} title="Record New Transaction">
            <div className="max-w-4xl mx-auto">
                <Card className="shadow-2xl shadow-primary/5">
                    <CardContent className="p-8">
                        {success && (
                            <div className="mb-8 p-4 bg-secondary/10 text-secondary rounded-2xl flex items-center gap-3 animate-fade-in">
                                <CheckCircle2 size={24} />
                                <span className="font-semibold">Transaction recorded successfully!</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Member Selection */}
                                <Controller
                                    name="member_id"
                                    control={control}
                                    render={({ field }) => (
                                        <Combobox
                                            label="Member Name"
                                            placeholder="Narrow suggestions by typing..."
                                            options={members || []}
                                            value={field.value}
                                            onChange={field.onChange}
                                            error={errors.member_id?.message}
                                        />
                                    )}
                                />

                                {/* Purpose Selection */}
                                <Controller
                                    name="purpose_id"
                                    control={control}
                                    render={({ field }) => (
                                        <Combobox
                                            label="Purpose/Activity"
                                            placeholder="Search purpose..."
                                            options={purposes || []}
                                            value={field.value}
                                            onChange={field.onChange}
                                            error={errors.purpose_id?.message}
                                        />
                                    )}
                                />

                                {/* Amount */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold ml-1">Amount (XAF)</label>
                                    <input
                                        type="number"
                                        {...register('amount', { valueAsNumber: true })}
                                        className="w-full p-4 rounded-xl bg-background-alt border border-border focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="e.g. 5000"
                                    />
                                    {errors.amount && <p className="text-destructive text-xs ml-1">{errors.amount.message}</p>}
                                </div>

                                {/* Date */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold ml-1">Transaction Date</label>
                                    <input
                                        type="date"
                                        {...register('transaction_date')}
                                        className="w-full p-4 rounded-xl bg-background-alt border border-border focus:ring-2 focus:ring-primary/20 outline-none"
                                    />
                                    {errors.transaction_date && <p className="text-destructive text-xs ml-1">{errors.transaction_date.message}</p>}
                                </div>

                                {/* Transaction Type */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold ml-1">Transaction Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['COLLECTION', 'DISBURSEMENT'].map(type => (
                                            <label key={type} className={`
                        flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${watch('transaction_type') === type ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-background-alt text-muted-foreground'}
                      `}>
                                                <input {...register('transaction_type')} type="radio" value={type} className="hidden" />
                                                <span className="font-bold text-xs">{type}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Destination */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold ml-1">Destination</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['CHAPTER', 'NATIONAL'].map(dest => (
                                            <label key={dest} className={`
                        flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${watch('destination') === dest ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-background-alt text-muted-foreground'}
                      `}>
                                                <input {...register('destination')} type="radio" value={dest} className="hidden" />
                                                <span className="font-bold text-xs">{dest}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-border flex justify-end">
                                <Button
                                    size="lg"
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full md:w-auto min-w-[200px]"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : 'Record Transaction'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}
