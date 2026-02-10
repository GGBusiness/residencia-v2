import { redirect } from 'next/navigation';

export default function HomePage() {
    // Redirecionar para cadastro na primeira vez
    redirect('/auth/signup');
}
