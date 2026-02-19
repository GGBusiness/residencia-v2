'use client';

import { useChat } from 'ai/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, X, MoreVertical, Paperclip, Smile } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useUser } from '@/hooks/useUser';
import { logStudyTimeAction } from '@/app/actions/study-time-actions';

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const sessionStartRef = useRef<number | null>(null);
    const { user } = useUser();

    // Migrated to useChat for standard Chat Completions / Responses API
    const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
        api: '/api/chat',
        initialMessages: [
            {
                id: 'welcome',
                role: 'assistant',
                content: 'Olá! Sou seu tutor pessoal. Analiso seus PDFs e tiro dúvidas sobre residência médica.'
            }
        ]
    });

    // Track chat session time
    const logChatSession = useCallback(async () => {
        if (sessionStartRef.current && user?.id) {
            const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);
            if (durationSeconds >= 10) {
                await logStudyTimeAction(user.id, 'chat', durationSeconds, {
                    messageCount: messages.filter(m => m.role === 'user').length,
                });
            }
            sessionStartRef.current = null;
        }
    }, [user?.id, messages]);

    // Start/stop timer when chat opens/closes
    useEffect(() => {
        if (isOpen) {
            sessionStartRef.current = Date.now();
        } else {
            logChatSession();
        }
    }, [isOpen]);

    // Log on page unload if chat is still open
    useEffect(() => {
        const handleUnload = () => {
            if (isOpen && sessionStartRef.current && user?.id) {
                const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);
                if (durationSeconds >= 10) {
                    // Use sendBeacon for reliability on page close
                    navigator.sendBeacon('/api/log-study-time', JSON.stringify({
                        userId: user.id,
                        activityType: 'chat',
                        durationSeconds,
                    }));
                }
            }
        };
        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, [isOpen, user?.id]);

    // Auto-scroll to bottom with smooth behavior
    useEffect(() => {
        if (scrollRef.current) {
            const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollElement) {
                scrollElement.scrollTo({ top: scrollElement.scrollHeight, behavior: 'smooth' });
            }
        }
    }, [messages, isLoading]);

    // Focus input when opening
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none font-sans antialiased">
            {/* Toggle Button with Notification Badge */}
            <div className="pointer-events-auto relative group">
                {/* Floating Help Bubble */}
                {!isOpen && (
                    <div className="absolute bottom-20 right-0 w-max max-w-[200px] mb-2 mr-2 animate-bounce-slow z-40 hidden md:block">
                        <div className="bg-white text-slate-800 text-sm font-medium py-2 px-3 rounded-xl shadow-lg border border-slate-100 relative">
                            Alguma dúvida? Pergunte ao Tutor IA 🤖
                            {/* Triangle pointer */}
                            <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white border-b border-r border-slate-100 transform rotate-45"></div>
                        </div>
                    </div>
                )}

                {/* Main Toggle Button */}
                <Button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 z-50 ${isOpen
                        ? 'bg-slate-800 rotate-90 scale-90'
                        : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:scale-110'
                        }`}
                >
                    {isOpen ? (
                        <X className="w-6 h-6 text-white" />
                    ) : (
                        <MessageCircle className="w-7 h-7 text-white" />
                    )}
                </Button>
                {!isOpen && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md animate-bounce">
                        1
                    </span>
                )}
            </div>

            {/* Chat Window - Messenger Style */}
            <div
                className={cn(
                    "pointer-events-auto mt-4 transition-all duration-400 cubic-bezier(0.16, 1, 0.3, 1) origin-bottom-right fixed bottom-24 right-4 z-50 sm:right-8 sm:bottom-28",
                    isOpen
                        ? "opacity-100 scale-100 translate-y-0"
                        : "opacity-0 scale-75 translate-y-10 pointer-events-none"
                )}
            >
                <Card className="w-[calc(100vw-32px)] sm:w-[400px] h-[600px] max-h-[75vh] sm:max-h-[80vh] flex flex-col shadow-2xl border-0 rounded-2xl overflow-hidden bg-[#f0f2f5]">
                    {/* Header */}
                    <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 shrink-0 shadow-sm">
                        <div className="flex items-center justify-between text-white">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/30">
                                        <span className="text-xl">🩺</span>
                                    </div>
                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-indigo-600 rounded-full"></span>
                                </div>
                                <div>
                                    <CardTitle className="text-base font-bold text-white flex items-center gap-1">
                                        Dr. IA
                                        <span className="bg-blue-500/30 text-[10px] px-1.5 py-0.5 rounded text-white/90 font-normal border border-white/20">GPT-4o</span>
                                    </CardTitle>
                                    <p className="text-xs text-blue-100 opacity-90">
                                        {isLoading ? 'Digitando...' : 'Online agora'}
                                    </p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full h-8 w-8">
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                        </div>
                    </CardHeader>

                    {/* Chat Area */}
                    <CardContent className="flex-1 p-0 overflow-hidden relative bg-[#e5ddd5] bg-opacity-10">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4b5563 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                        <ScrollArea className="h-full px-4 py-4" ref={scrollRef}>
                            <div className="space-y-6 pb-2">
                                {messages.map((m) => (
                                    <div
                                        key={m.id}
                                        className={cn(
                                            "flex w-full",
                                            m.role === 'user' ? "justify-end" : "justify-start"
                                        )}
                                    >
                                        <div className={cn(
                                            "flex max-w-[85%] flex-col",
                                            m.role === 'user' ? "items-end" : "items-start"
                                        )}>
                                            <div
                                                className={cn(
                                                    "px-4 py-2.5 shadow-sm text-[15px] leading-relaxed relative group",
                                                    m.role === 'user'
                                                        ? "bg-blue-600 text-white rounded-2xl rounded-tr-sm" // User Bubble
                                                        : "bg-white text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100" // Bot Bubble
                                                )}
                                            >
                                                <div className="whitespace-pre-wrap">{m.content}</div>

                                                {/* Timestamp Mock */}
                                                <span className={cn(
                                                    "text-[10px] opacity-70 block text-right mt-1",
                                                    m.role === 'user' ? "text-blue-100" : "text-gray-400"
                                                )}>
                                                    Agora
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {isLoading && (
                                    <div className="flex justify-start w-full">
                                        <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>

                    {/* Input Area */}
                    <CardFooter className="p-3 bg-white border-t border-gray-100 shrink-0">
                        <form
                            onSubmit={handleSubmit}
                            className="flex w-full items-end gap-2"
                        >
                            <Button type="button" size="icon" variant="ghost" className="text-gray-400 hover:text-gray-600 rounded-full h-10 w-10 shrink-0">
                                <Paperclip className="h-5 w-5" />
                            </Button>

                            <div className="flex-1 relative">
                                <Input
                                    ref={inputRef}
                                    value={input}
                                    onChange={handleInputChange}
                                    placeholder="Digite sua mensagem..."
                                    className="w-full rounded-2xl bg-gray-100 border-0 focus-visible:ring-1 focus-visible:ring-blue-500 py-3 px-4 min-h-[44px] max-h-32 shadow-inner resize-none"
                                    disabled={isLoading}
                                />
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 h-8 w-8 rounded-full"
                                >
                                    <Smile className="h-5 w-5" />
                                </Button>
                            </div>

                            <Button
                                type="submit"
                                size="icon"
                                className={cn(
                                    "rounded-full h-11 w-11 shrink-0 transition-all duration-300 shadow-md",
                                    input.trim() ? "bg-blue-600 hover:bg-blue-700 scale-100" : "bg-gray-200 text-gray-400 scale-95"
                                )}
                                disabled={isLoading || !input.trim()}
                            >
                                <Send className="h-5 w-5 ml-0.5" />
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
