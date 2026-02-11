import { useState, useEffect } from 'react';
import { X, Search, Check } from 'lucide-react';
import { Button } from './button';

interface MultiSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    items: string[];
    selectedItems: string[];
    onConfirm: (selected: string[]) => void;
    searchPlaceholder?: string;
}

export function MultiSelectModal({
    isOpen,
    onClose,
    title,
    items,
    selectedItems,
    onConfirm,
    searchPlaceholder = "Buscar..."
}: MultiSelectModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentSelection, setCurrentSelection] = useState<string[]>([]);

    // Reset selection when modal opens
    useEffect(() => {
        if (isOpen) {
            setCurrentSelection(selectedItems);
            setSearchTerm('');
        }
    }, [isOpen, selectedItems]);

    if (!isOpen) return null;

    const filteredItems = items.filter(item =>
        item.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleItem = (item: string) => {
        setCurrentSelection(prev =>
            prev.includes(item)
                ? prev.filter(i => i !== item)
                : [...prev, item]
        );
    };

    const handleSelectAll = () => {
        if (currentSelection.length === filteredItems.length) {
            setCurrentSelection([]);
        } else {
            setCurrentSelection(filteredItems);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Search & Actions */}
                <div className="p-4 bg-gray-50 border-b space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder={searchPlaceholder}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-xl border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                        />
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">
                            {currentSelection.length} selecionado(s)
                        </span>
                        <button
                            onClick={handleSelectAll}
                            className="text-indigo-600 font-medium hover:text-indigo-800"
                        >
                            {currentSelection.length === filteredItems.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-2">
                    <div className="grid grid-cols-1 gap-1">
                        {filteredItems.map((item) => {
                            const isSelected = currentSelection.includes(item);
                            return (
                                <button
                                    key={item}
                                    onClick={() => toggleItem(item)}
                                    className={`flex items-center justify-between p-3 rounded-xl text-left transition-all ${isSelected
                                            ? 'bg-indigo-50 border border-indigo-200'
                                            : 'hover:bg-gray-50 border border-transparent'
                                        }`}
                                >
                                    <span className={`font-medium ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                                        {item}
                                    </span>
                                    {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                                </button>
                            );
                        })}
                        {filteredItems.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                Nenhum item encontrado.
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                    <Button variant="ghost" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={() => onConfirm(currentSelection)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        disabled={currentSelection.length === 0}
                    >
                        Confirmar Seleção ({currentSelection.length})
                    </Button>
                </div>
            </div>
        </div>
    );
}
