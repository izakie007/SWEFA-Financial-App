import type { ReactNode } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
    LogOut,
    Menu,
    X,
    User as UserIcon,
    MapPin
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button';

interface NavItem {
    label: string;
    path: string;
    icon: any;
}

export function DashboardLayout({
    children,
    navItems,
    title
}: {
    children: ReactNode;
    navItems: NavItem[];
    title: string;
}) {
    const { profile, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-background-alt text-foreground flex flex-col md:flex-row">
            {/* Sidebar - Desktop */}
            <aside className="hidden md:flex w-72 flex-col bg-surface border-r border-border p-6 space-y-8 sticky top-0 h-screen">
                <div className="flex items-center gap-3 px-2">
                    <div className="w-10 h-10 rounded-xl premium-gradient flex items-center justify-center text-white font-bold text-xl">
                        S
                    </div>
                    <div>
                        <h2 className="font-bold text-lg leading-none">SWEFA</h2>
                        <p className="text-xs text-muted-foreground mt-1">Finance Portal</p>
                    </div>
                </div>

                <nav className="flex-1 space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${location.pathname === item.path
                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                        >
                            <item.icon size={20} />
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="pt-6 border-t border-border space-y-4">
                    <div className="flex items-center gap-3 px-4">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                            <UserIcon size={20} />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-semibold truncate">{profile?.role_code.replace('_', ' ')}</p>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <MapPin size={10} />
                                <span className="truncate">Chapter Office</span>
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10" onClick={handleSignOut}>
                        <LogOut size={20} />
                        Sign Out
                    </Button>
                </div>
            </aside>

            {/* Mobile Header */}
            <header className="md:hidden bg-surface border-b border-border p-4 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg premium-gradient flex items-center justify-center text-white font-bold">S</div>
                    <span className="font-bold">SWEFA</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-muted-foreground">
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </header>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-40 bg-background pt-20 p-6 animate-fade-in">
                    <nav className="space-y-2">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`flex items-center gap-3 px-4 py-4 rounded-2xl transition-all ${location.pathname === item.path
                                    ? 'bg-primary text-white shadow-lg'
                                    : 'text-muted-foreground hover:bg-muted'
                                    }`}
                            >
                                <item.icon size={24} />
                                <span className="font-semibold text-lg">{item.label}</span>
                            </Link>
                        ))}
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-destructive hover:bg-destructive/10 transition-all font-semibold text-lg"
                        >
                            <LogOut size={24} />
                            Sign Out
                        </button>
                    </nav>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-10 space-y-8 overflow-y-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="text-2xl font-bold md:text-3xl text-foreground">{title}</h1>
                    <div className="flex items-center gap-4">
                        {/* Optional Toolbar */}
                    </div>
                </div>
                {children}
            </main>
        </div>
    );
}
