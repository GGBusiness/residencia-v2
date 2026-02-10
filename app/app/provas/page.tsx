'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { dataService, type Document } from '@/lib/data-service';
import { debounce } from '@/lib/utils';
import Link from 'next/link';

const AREAS = [
    'Clínica Médica',
    'Cirurgia',
    'Ginecologia e Obstetrícia',
    'Pediatria',
    'Medicina Preventiva',
];

export default function ProvasPage() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({
        area: '',
        years: [] as number[],
        hasAnswerKey: false as boolean | undefined,
    });
    const [showFilters, setShowFilters] = useState(false);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            const result = await dataService.searchDocuments({
                query: search,
                types: ['PROVA', 'EXAM'],
                area: filters.area || undefined,
                years: filters.years.length > 0 ? filters.years : undefined,
                hasAnswerKey: filters.hasAnswerKey,
                sort: 'year_desc',
            });
            setDocuments(result.data);
        } catch (error) {
            console.error('Error loading documents:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, [filters]);

    const debouncedSearch = debounce(() => {
        loadDocuments();
    }, 500);

    useEffect(() => {
        if (search !== '') {
            debouncedSearch();
        } else {
            loadDocuments();
        }
    }, [search]);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                        Provas Antigas
                    </h1>
                    <p className="text-gray-600">
                        Acesse provas de ENARE, USP, UNICAMP e outras instituições
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6 lg:px-8">
                {/* Search and Filters */}
                <div className="mb-6 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Buscar provas..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setShowFilters(!showFilters)}
                            className="sm:w-auto"
                        >
                            <Filter className="w-4 h-4 mr-2" />
                            Filtros
                            <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                        </Button>
                    </div>

                    {showFilters && (
                        <Card>
                            <CardBody className="p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Grande Área
                                    </label>
                                    <select
                                        value={filters.area}
                                        onChange={(e) => setFilters({ ...filters, area: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                    >
                                        <option value="">Todas</option>
                                        {AREAS.map((area) => (
                                            <option key={area} value={area}>
                                                {area}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={filters.hasAnswerKey === true}
                                            onChange={(e) =>
                                                setFilters({
                                                    ...filters,
                                                    hasAnswerKey: e.target.checked ? true : undefined,
                                                })
                                            }
                                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">
                                            Somente com gabarito
                                        </span>
                                    </label>
                                </div>
                            </CardBody>
                        </Card>
                    )}
                </div>

                {/* Results */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <CardSkeleton key={i} />
                        ))}
                    </div>
                ) : documents.length === 0 ? (
                    <Card>
                        <CardBody className="p-12 text-center">
                            <p className="text-gray-500 mb-4">Nenhuma prova encontrada</p>
                            <Button variant="outline" onClick={() => { setSearch(''); setFilters({ area: '', years: [], hasAnswerKey: undefined }); }}>
                                Limpar filtros
                            </Button>
                        </CardBody>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {documents.map((doc) => (
                            <Card key={doc.id} hover>
                                <CardBody className="p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <h3 className="font-bold text-gray-900 text-lg line-clamp-2 flex-1">
                                            {doc.title}
                                        </h3>
                                        {doc.has_answer_key && (
                                            <Badge variant="success" className="ml-2 flex-shrink-0">
                                                Gabarito
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        {doc.year && (
                                            <p className="text-sm text-gray-600">
                                                <span className="font-medium">Ano:</span> {doc.year}
                                            </p>
                                        )}
                                        {(doc.program || doc.institution) && (
                                            <p className="text-sm text-gray-600">
                                                <span className="font-medium">Instituição:</span>{' '}
                                                {doc.program || doc.institution}
                                            </p>
                                        )}
                                        {doc.area && (
                                            <p className="text-sm text-gray-600">
                                                <span className="font-medium">Área:</span> {doc.area}
                                            </p>
                                        )}
                                    </div>

                                    {doc.tags && doc.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-4">
                                            {doc.tags.slice(0, 3).map((tag, idx) => (
                                                <Badge key={idx} variant="default" className="text-xs">
                                                    {tag}
                                                </Badge>
                                            ))}
                                            {doc.tags.length > 3 && (
                                                <Badge variant="default" className="text-xs">
                                                    +{doc.tags.length - 3}
                                                </Badge>
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2">
                                        <Link href={`/app/viewer/${doc.id}`}>
                                            <Button variant="outline" size="sm" className="w-full">
                                                Ver PDF
                                            </Button>
                                        </Link>
                                        <Link href={`/app/monta-provas?doc=${doc.id}`}>
                                            <Button variant="primary" size="sm" className="w-full">
                                                Usar
                                            </Button>
                                        </Link>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
