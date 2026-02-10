'use server';

import { query } from '@/lib/db';
import type { Document } from './data-service';

export interface SelectionCriteria {
    area?: string;
    years?: number[];
    questionCount: number;
    programs?: string[];
    objective?: string;
}

/**
 * Seleciona documentos baseado nos critérios do usuário
 * Lógica de seleção inteligente para MVP
 */
export async function selectDocuments(criteria: SelectionCriteria): Promise<Document[]> {
    const { area, years, questionCount, programs, objective } = criteria;

    // Calcular quantos PDFs selecionar baseado na quantidade de questões
    const numDocuments = calculateDocumentCount(questionCount);

    // Construir query SQL
    let sql = "SELECT * FROM documents WHERE type = 'PROVA'";
    const params: any[] = [];
    let pIndex = 1;

    // Filtrar por área se especificado
    if (area && area !== 'todas') {
        const areaMap: Record<string, string> = {
            'clinica': 'Clínica Médica',
            'cirurgia': 'Cirurgia',
            'go': 'GO',
            'pediatria': 'Pediatria',
            'preventiva': 'Preventiva',
        };

        const mappedArea = areaMap[area] || area;
        sql += ` AND area = $${pIndex}`;
        params.push(mappedArea);
        pIndex++;
    }

    // Filtrar por anos se especificado
    if (years && years.length > 0) {
        sql += ` AND year = ANY($${pIndex}::int[])`;
        params.push(years);
        pIndex++;
    }

    // Filtrar por instituições se especificado
    if (programs && programs.length > 0) {
        sql += ` AND institution = ANY($${pIndex}::text[])`;
        params.push(programs);
        pIndex++;
    }

    // Ordenar por ano decrescente (provas mais recentes primeiro)
    sql += ` ORDER BY year DESC`;

    // Buscar mais documentos do que o necessário para ter opções
    // Em SQL usamos LIMIT
    sql += ` LIMIT $${pIndex}`;
    params.push(numDocuments * 3);

    try {
        const { rows } = await query(sql, params);
        const documents = rows as Document[];

        if (!documents || documents.length === 0) {
            // Se não encontrou nada, tenta buscar sem filtro de instituição para não falhar totalmente
            if (programs && programs.length > 0) {
                // Retry logic could be added here, basically run query again without programs filter
                // For now, let's just return empty array or throw as before
            }
            // Don't throw immediately, let the empty check below handle it or return empty
        }

        if (documents.length === 0) {
            // Fallback: return any documents if specific filters failed? 
            // Or throw
            throw new Error('Nenhum documento encontrado com os critérios especificados');
        }

        // Aplicar lógica de seleção inteligente (in-memory filtering/sorting of the fetched subset)
        const selected = applySmartSelection(documents, criteria, numDocuments);

        return selected;

    } catch (error) {
        console.error('Error selecting documents:', error);
        throw error; // Propagate error
    }
}

/**
 * Calcula quantos documentos selecionar baseado na quantidade de questões
 */
function calculateDocumentCount(questionCount: number): number {
    if (questionCount <= 30) return 2;
    if (questionCount <= 50) return 3;
    if (questionCount <= 70) return 4;
    return 5;
}

/**
 * Aplica lógica de seleção inteligente aos documentos
 */
function applySmartSelection(
    documents: Document[],
    criteria: SelectionCriteria,
    numDocuments: number
): Document[] {
    const { objective } = criteria;

    // Diferentes estratégias baseadas no objetivo
    switch (objective) {
        case 'prova-completa':
            // Priorizar provas completas de instituições renomadas
            return selectByInstitution(documents, numDocuments, ['ENARE', 'USP', 'UNICAMP']);

        case 'revisao-rapida':
            // Variedade de anos e instituições
            return selectDiverse(documents, numDocuments);

        case 'pontos-fracos':
            // Provas mais completas (sem filtro específico por agora)
            return selectRecent(documents, numDocuments);

        case 'subarea-especifica':
            // Focar em área específica
            return selectByArea(documents, numDocuments);

        default:
            return selectRecent(documents, numDocuments);
    }
}

/**
 * Seleciona por instituições preferenciais
 */
function selectByInstitution(
    documents: Document[],
    count: number,
    preferredInstitutions: string[]
): Document[] {
    const preferred: Document[] = [];
    const others: Document[] = [];

    documents.forEach((doc) => {
        if (doc.institution && preferredInstitutions.includes(doc.institution)) {
            preferred.push(doc);
        } else {
            others.push(doc);
        }
    });

    // Pegar da preferência primeiro, depois completar com outros
    const selected = [...preferred.slice(0, count)];

    if (selected.length < count) {
        selected.push(...others.slice(0, count - selected.length));
    }

    return selected;
}

/**
 * Seleciona documentos mais recentes
 */
function selectRecent(documents: Document[], count: number): Document[] {
    // Já vem ordenado por ano DESC
    return documents.slice(0, count);
}

/**
 * Seleciona com diversidade (diferentes anos e instituições)
 */
function selectDiverse(documents: Document[], count: number): Document[] {
    const selected: Document[] = [];
    const usedInstitutions = new Set<string>();
    const usedYears = new Set<number>();

    // Primeira passada: pegar um de cada instituição/ano diferente
    for (const doc of documents) {
        if (selected.length >= count) break;

        const isNewInstitution = doc.institution && !usedInstitutions.has(doc.institution);
        const isNewYear = doc.year && !usedYears.has(doc.year);

        if (isNewInstitution || isNewYear) {
            selected.push(doc);
            if (doc.institution) usedInstitutions.add(doc.institution);
            if (doc.year) usedYears.add(doc.year);
        }
    }

    // Segunda passada: completar se necessário
    if (selected.length < count) {
        const remaining = documents.filter((doc) => !selected.includes(doc));
        selected.push(...remaining.slice(0, count - selected.length));
    }

    return selected;
}

/**
 * Seleciona por área específica (já filtrado na query)
 */
function selectByArea(documents: Document[], count: number): Document[] {
    return selectRecent(documents, count);
}
