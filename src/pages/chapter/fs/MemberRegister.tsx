import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { DashboardLayout } from '../../../components/layout/DashboardLayout';
import {
    LayoutDashboard,
    Users,
    HandCoins,
    History,
    FileText,
    Loader2,
    Plus,
    Pencil,
    Trash2,
    Search,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { Card, CardContent, Table, TableHeader, TableRow, TableHeaderCell, TableCell } from '../../../components/ui/DataDisplay';
import { Button } from '../../../components/ui/Button';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
    { label: 'Dashboard', path: '/chapter/fs', icon: LayoutDashboard },
    { label: 'Member Ledger', path: '/chapter/fs/ledger', icon: Users },
    { label: 'Member Register', path: '/chapter/fs/members', icon: Users },
    { label: 'Record Transaction', path: '/chapter/fs/record', icon: HandCoins },
    { label: 'Handover', path: '/chapter/fs/handover', icon: History },
    { label: 'Reports', path: '/chapter/fs/reports', icon: FileText },
];

const memberSchema = z.object({
    full_name: z.string().min(3, 'Name must be at least 3 characters'),
    membership_number: z.string().min(1, 'ID Card / Membership Number is required'),
    phone_number: z.string().optional(),
    membership_year: z.string().regex(/^\d{4}$/, 'Must be a 4-digit year').optional(),
});

type MemberFormValues = z.infer<typeof memberSchema>;

export default function MemberRegister() {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<any>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const { data: members, isLoading } = useQuery({
        queryKey: ['members', profile?.chapter_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('members')
                .select('*')
                .eq('chapter_id', profile?.chapter_id)
                .eq('is_active', true)
                .order('full_name', { ascending: true });
            if (error) throw error;
            return data;
        },
        enabled: !!profile?.chapter_id,
    });

    const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<MemberFormValues>({
        resolver: zodResolver(memberSchema),
    });

    const memberMutation = useMutation({
        mutationFn: async (values: MemberFormValues) => {
            if (editingMember) {
                const { error } = await supabase
                    .from('members')
                    .update(values)
                    .eq('id', editingMember.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('members')
                    .insert({
                        ...values,
                        chapter_id: profile?.chapter_id,
                    });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['members'] });
            setSuccess(editingMember ? 'Member updated successfully!' : 'Member added successfully!');
            closeModal();
            setTimeout(() => setSuccess(null), 5000);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('members')
                .update({ is_active: false })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['members'] });
            setSuccess('Member removed from active register.');
            setTimeout(() => setSuccess(null), 5000);
        },
    });

    const openModal = (member: any = null) => {
        setEditingMember(member);
        if (member) {
            setValue('full_name', member.full_name);
            setValue('membership_number', member.membership_number);
            setValue('phone_number', member.phone_number || '');
            setValue('membership_year', member.membership_year || '');
        } else {
            reset({
                full_name: '',
                membership_number: '',
                phone_number: '',
                membership_year: '',
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingMember(null);
        reset();
    };

    const onSubmit = (data: MemberFormValues) => memberMutation.mutate(data);

    const filteredMembers = members?.filter(m =>
        m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.membership_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DashboardLayout navItems={navItems} title="Membership Register">
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name or ID..."
                            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-surface border border-border outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={() => openModal()} className="flex items-center gap-2 px-6 py-3 rounded-2xl shadow-lg shadow-primary/20">
                        <Plus size={20} />
                        Add Member
                    </Button>
                </div>

                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-secondary/10 text-secondary border border-secondary/20 rounded-2xl flex items-center gap-3 font-semibold text-sm"
                    >
                        <CheckCircle2 size={18} />
                        {success}
                    </motion.div>
                )}

                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Full Name</TableHeaderCell>
                                    <TableHeaderCell>ID / Membership #</TableHeaderCell>
                                    <TableHeaderCell>Phone</TableHeaderCell>
                                    <TableHeaderCell>Join Year</TableHeaderCell>
                                    <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <tbody>
                                {isLoading ? (
                                    [1, 2, 3].map(i => (
                                        <TableRow key={i}>
                                            {[1, 2, 3, 4, 5].map(j => (
                                                <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-24" /></TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : filteredMembers?.map((member) => (
                                    <TableRow key={member.id} className="group">
                                        <TableCell className="font-bold text-foreground">{member.full_name}</TableCell>
                                        <TableCell className="text-muted-foreground font-mono text-xs">{member.membership_number}</TableCell>
                                        <TableCell className="text-muted-foreground">{member.phone_number || 'N/A'}</TableCell>
                                        <TableCell className="text-muted-foreground">{member.membership_year || member.created_at.split('-')[0]}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openModal(member)}
                                                    className="hover:bg-primary/10 text-primary p-2"
                                                >
                                                    <Pencil size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (confirm(`Are you sure you want to remove ${member.full_name}?`)) {
                                                            deleteMutation.mutate(member.id);
                                                        }
                                                    }}
                                                    className="hover:bg-destructive/10 text-destructive p-2"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </tbody>
                        </Table>
                        {!isLoading && !filteredMembers?.length && (
                            <div className="p-20 text-center space-y-3">
                                <Users size={48} className="mx-auto text-muted-foreground/30" />
                                <p className="text-muted-foreground font-medium">No members found matching your search.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeModal}
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg bg-surface border border-border rounded-[2.5rem] shadow-2xl p-8 overflow-hidden glass-morphism"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-2xl font-black">{editingMember ? 'Edit Member' : 'New Member'}</h3>
                                <button onClick={closeModal} className="p-2 hover:bg-muted rounded-full transition-colors">
                                    <XCircle className="text-muted-foreground" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold ml-1">Full Name</label>
                                    <input
                                        {...register('full_name')}
                                        placeholder="Enter full name"
                                        className="w-full p-4 rounded-xl bg-background-alt border border-border focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                                    />
                                    {errors.full_name && <p className="text-destructive text-xs ml-1">{errors.full_name.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold ml-1">ID Card / Membership #</label>
                                    <input
                                        {...register('membership_number')}
                                        placeholder="e.g. SWEFA-2024-001"
                                        className="w-full p-4 rounded-xl bg-background-alt border border-border focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                                    />
                                    {errors.membership_number && <p className="text-destructive text-xs ml-1">{errors.membership_number.message}</p>}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold ml-1">Phone Number</label>
                                        <input
                                            {...register('phone_number')}
                                            placeholder="+237 ..."
                                            className="w-full p-4 rounded-xl bg-background-alt border border-border focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold ml-1">Membership Year</label>
                                        <input
                                            {...register('membership_year')}
                                            placeholder="e.g. 2024"
                                            className="w-full p-4 rounded-xl bg-background-alt border border-border focus:ring-2 focus:ring-primary/20 outline-none"
                                        />
                                        {errors.membership_year && <p className="text-destructive text-xs ml-1">{errors.membership_year.message}</p>}
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <Button type="button" variant="outline" onClick={closeModal} className="flex-1 py-4 rounded-2xl font-bold">
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={isSubmitting} className="flex-2 py-4 rounded-2xl font-bold">
                                        {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={24} /> : (editingMember ? 'Update Member' : 'Registry Entry')}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
}
