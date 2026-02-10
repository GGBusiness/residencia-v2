import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

// Client-side Supabase client
export const supabase = createClientComponentClient();

// Server-side Supabase client (for server actions)
export const createServerClient = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    return createClient(supabaseUrl, supabaseKey);
};

export type Database = {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string;
                    name: string | null;
                    created_at: string;
                };
            };
            documents: {
                Row: {
                    id: string;
                    title: string;
                    doc_type: string;
                    year: number | null;
                    program: string | null;
                    institution: string | null;
                    area: string | null;
                    tags: string[] | null;
                    has_answer_key: boolean;
                    file_path: string | null;
                    metadata: any;
                    created_at: string;
                };
            };
            attempts: {
                Row: {
                    id: string;
                    user_id: string;
                    attempt_type: string;
                    config: any;
                    feedback_mode: 'PROVA' | 'ESTUDO';
                    started_at: string;
                    completed_at: string | null;
                    timer_seconds: number | null;
                    status: 'IN_PROGRESS' | 'COMPLETED';
                };
            };
            attempt_answers: {
                Row: {
                    id: string;
                    attempt_id: string;
                    question_index: number;
                    choice: string | null;
                    flagged: boolean;
                    created_at: string;
                    updated_at: string;
                };
            };
            questions: {
                Row: {
                    id: string;
                    document_id: string;
                    number_in_exam: number;
                    stem: string;
                    option_a: string | null;
                    option_b: string | null;
                    option_c: string | null;
                    option_d: string | null;
                    option_e: string | null;
                    correct_option: string | null;
                    explanation: string | null;
                    area: string | null;
                    subarea: string | null;
                    topic: string | null;
                };
            };
        };
    };
};
