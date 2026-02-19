import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
// Force restart 2
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
    const res = NextResponse.next();
    const supabase = createMiddlewareClient({ req, res });

    // 1. Refresh session (Standard Supabase)
    await supabase.auth.getSession();

    // 2. Admin Protection (Custom Cookie)
    const path = req.nextUrl.pathname;

    // Se for rota /admin (e não for login), verifica o cookie
    if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
        const adminCookie = req.cookies.get('admin_access_token');
        const isValid = adminCookie?.value === 'valid';

        if (!isValid) {
            // Se não tiver cookie, redireciona para login
            return NextResponse.redirect(new URL('/admin/login', req.url));
        }
    }

    return res;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
