import { useState, useRef, useEffect } from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
    id: string;
    label: string;
}

interface ComboboxProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    label?: string;
    error?: string;
}

export function Combobox({
    options,
    value,
    onChange,
    placeholder = "Select option...",
    className,
    label,
    error
}: ComboboxProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.id === value);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={twMerge("space-y-1.5", className)} ref={containerRef}>
            {label && <label className="text-sm font-semibold ml-1 text-foreground/80">{label}</label>}

            <div className="relative">
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className={twMerge(
                        "w-full p-4 rounded-xl bg-background border border-border flex items-center justify-between cursor-pointer transition-all hover:border-primary/50",
                        isOpen && "ring-2 ring-primary/20 border-primary",
                        error && "border-destructive ring-destructive/10"
                    )}
                >
                    <span className={twMerge("line-clamp-1", !selectedOption && "text-muted-foreground")}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <ChevronsUpDown size={18} className="text-muted-foreground shrink-0" />
                </div>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-50 w-full mt-2 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden glass-morphism"
                        >
                            <div className="p-2 border-b border-border flex items-center gap-2">
                                <Search size={16} className="text-muted-foreground ml-2" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Search..."
                                    className="w-full bg-transparent p-2 outline-none text-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="p-1 hover:bg-muted rounded-md transition-colors">
                                        <X size={14} className="text-muted-foreground" />
                                    </button>
                                )}
                            </div>
                            <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                                {filteredOptions.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                        No results found.
                                    </div>
                                ) : (
                                    filteredOptions.map((option) => (
                                        <div
                                            key={option.id}
                                            onClick={() => {
                                                onChange(option.id);
                                                setIsOpen(false);
                                                setSearchTerm('');
                                            }}
                                            className={twMerge(
                                                "flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors text-sm",
                                                option.id === value ? "bg-primary text-white" : "hover:bg-muted"
                                            )}
                                        >
                                            <span className="font-medium">{option.label}</span>
                                            {option.id === value && <Check size={16} />}
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            {error && <p className="text-xs text-destructive ml-1">*{error}</p>}
        </div>
    );
}
