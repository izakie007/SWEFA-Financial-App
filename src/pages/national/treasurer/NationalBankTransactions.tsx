import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import {
    BarChart3,
    ShieldCheck,
    Landmark,
    FileStack,
    Loader2,
    ArrowUpRight,
    ArrowDownLeft,
    Wallet
} from 'lucide-react';
import { Card, CardContent, Table, TableHeader, TableRow, TableHeaderCell, TableCell } from '../../../components/ui/DataDisplay';
import { Button } from '../../../components/ui/Button';
import { Combobox } from '../../../components/ui/Combobox';
import { formatCurrency } from '../../../lib/formatters';
import { useState, useEffect } from 'react';

const navItems = [
    { label: 'Dashboard', path: '/national/treasurer', icon: BarChart3 },
    { label: 'NT Reconciliation', path: '/national/treasurer/reconciliation', icon: ShieldCheck },
    { label: 'National Bank', path: '/national/treasurer/bank', icon: Landmark },
    { label: 'Global Reports', path: '/national/treasurer/reports', icon: FileStack },
];

const createBankSchema = (cashBalance: number, bankBalance: number, transactionType: string) => z.object({
    purpose_id: z.string().uuid('Please select a purpose'),
    amount: z.number()
        .min(1, 'Amount must be greater than 0')
        .refine((val) => {
            if (transactionType === 'DEPOSIT') {
                return val <= cashBalance;
            } else if (transactionType === 'WITHDRAWAL') {
                return val <= bankBalance;
            }
            return true;
        }, {
            message: transactionType === 'DEPOSIT'
                ? `Insufficient cash. Available: ${new Intl.NumberFormat('en-CM').format(cashBalance)} XAF`
                : `Insufficient bank balance. Available: ${new Intl.NumberFormat('en-CM').format(bankBalance)} XAF`
        }),
    transaction_type: z.enum(['DEPOSIT', 'WITHDRAWAL']),
    transaction_date: z.string(),
    reference_number: z.string().optional(),
});

type BankFormValues = {
    purpose_id: string;
    amount: number;
    transaction_type: 'DEPOSIT' | 'WITHDRAWAL';
    transaction_date: string;
    reference_number?: string;
};

export default function NationalBankTransactions() {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const [success, setSuccess] = useState(false);

    // Fetch treasurer cash and bank balances
    const { data: balances, isLoading: balanceLoading } = useQuery({
        queryKey: ['national-treasurer-balances'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('v_national_cash_position')
                .select('treasurer_cash_balance, bank_balance')
                .single();
            if (error) throw error;
            return {
                cash: data?.treasurer_cash_balance || 0,
                bank: data?.bank_balance || 0
            };
        },
    });

    // Fetch purposes
    const { data: purposes } = useQuery({
        queryKey: ['purposes'],
        queryFn: async () => {
            const { data, error } = await supabase.from('purposes').select('id, name').eq('is_active', true);
            if (error) throw error;
            return data?.map(p => ({ id: p.id, label: p.name || 'Unknown Purpose' })) || [];
        },
    });

    // Fetch recent bank transactions
    const { data: transactions, isLoading } = useQuery({
        queryKey: ['national-bank-transactions'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('national_bank_transactions')
                .select('*, purposes(name)')
                .order('transaction_date', { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    const [currentTransactionType, setCurrentTransactionType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');

    const { register, handleSubmit, reset, watch, control, formState: { errors, isSubmitting } } = useForm<BankFormValues>({
        resolver: zodResolver(createBankSchema(
            balances?.cash || 0,
            balances?.bank || 0,
            currentTransactionType
        )),
        defaultValues: {
            transaction_type: 'DEPOSIT',
            transaction_date: new Date().toISOString().split('T')[0],
        }
    });

    // Watch for transaction type changes
    const transactionType = watch('transaction_type');

    // Update current transaction type when form value changes
    useEffect(() => {
        if (transactionType) {
            setCurrentTransactionType(transactionType);
        }
    }, [transactionType]);

    const mutation = useMutation({
        mutationFn: async (values: BankFormValues) => {
            const { error } = await supabase.from('national_bank_transactions').insert({
                ...values,
                recorded_by: profile?.user_id,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            setSuccess(true);
            reset();
            queryClient.invalidateQueries({ queryKey: ['national-bank-transactions'] });
            setTimeout(() => setSuccess(false), 5000);
        },
    });

    const onSubmit = (data: BankFormValues) => mutation.mutate(data);

    return (
        <DashboardLayout navItems={navItems} title="National Bank Management">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1 h-fit">
                    <CardContent className="p-8">
                        <h3 className="text-xl font-bold mb-6">Record Bank Activity</h3>
                        {success && (
                            <div className="mb-6 p-4 bg-secondary/10 text-secondary rounded-xl text-center font-semibold text-sm">
                                Transaction recorded.
                            </div>
                        )}

                        {/* Balance Display */}
                        <div className="mb-6 grid grid-cols-2 gap-3">
                            <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                                <div className="flex items-center gap-1 mb-1">
                                    <Wallet size={14} className="text-primary" />
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">Cash</span>
                                </div>
                                {balanceLoading ? (
                                    <div className="h-6 bg-muted animate-pulse rounded w-20" />
                                ) : (
                                    <p className="text-lg font-black text-primary">
                                        {formatCurrency(balances?.cash || 0)}
                                    </p>
                                )}
                            </div>
                            <div className="p-3 bg-secondary/5 border border-secondary/20 rounded-xl">
                                <div className="flex items-center gap-1 mb-1">
                                    <Landmark size={14} className="text-secondary" />
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">Bank</span>
                                </div>
                                {balanceLoading ? (
                                    <div className="h-6 bg-muted animate-pulse rounded w-20" />
                                ) : (
                                    <p className="text-lg font-black text-secondary">
                                        {formatCurrency(balances?.bank || 0)}
                                    </p>
                                )}
                            </div>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['DEPOSIT', 'WITHDRAWAL'].map(type => (
                                        <label key={type} className={`
                      flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all
                      ${watch('transaction_type') === type ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}
                    `}>
                                            <input {...register('transaction_type')} type="radio" value={type} className="hidden" />
                                            <span className="font-bold text-xs">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

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
                                <label className="text-sm font-medium">Amount (XAF)</label>
                                <input
                                    type="number"
                                    {...register('amount', { valueAsNumber: true })}
                                    className="w-full p-4 rounded-xl bg-background-alt border border-border focus:ring-2 focus:ring-primary/20 outline-none"
                                    placeholder="e.g. 500000"
                                />
                                {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Ref #</label>
                                <input
                                    type="text"
                                    {...register('reference_number')}
                                    className="w-full p-4 rounded-xl bg-background-alt border border-border outline-none"
                                    placeholder="Slip/Voucher number"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Date</label>
                                <input
                                    type="date"
                                    {...register('transaction_date')}
                                    className="w-full p-4 rounded-xl bg-background-alt border border-border outline-none"
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : 'Save Bank Record'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                    <div className="p-6 border-b border-border">
                        <h3 className="font-bold flex items-center gap-2">
                            <Landmark size={20} className="text-primary" />
                            Recent Bank Activity
                        </h3>
                    </div>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Date</TableHeaderCell>
                                    <TableHeaderCell>Purpose</TableHeaderCell>
                                    <TableHeaderCell>Type</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Amount</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <tbody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={4} className="p-10 text-center animate-pulse">Loading...</TableCell></TableRow>
                                ) : transactions?.map((t: any) => (
                                    <TableRow key={t.id}>
                                        <TableCell className="text-muted-foreground">{new Date(t.transaction_date).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold">{t.purposes?.name}</span>
                                                <span className="text-[10px] text-muted-foreground">Ref: {t.reference_number || 'N/A'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`flex items-center gap-1 text-[10px] font-black uppercase ${t.transaction_type === 'DEPOSIT' ? 'text-secondary' : 'text-destructive'}`}>
                                                {t.transaction_type === 'DEPOSIT' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                                                {t.transaction_type}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-black text-foreground">
                                            {formatCurrency(t.amount)}
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
