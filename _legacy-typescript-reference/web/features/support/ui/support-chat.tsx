"use client"

import { useState, useEffect, useRef } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
    Send,
    Loader2,
    User,
    ShieldCheck,
    ArrowLeft,
    Clock,
    Sparkles,
    Bot,
    ChevronDown,
    ChevronUp
} from "lucide-react"
import { Button } from "@shared/ui/button"
import { Textarea } from "@shared/ui/textarea"
import { toast } from "sonner"
import { useChat } from "@ai-sdk/react"
import type { UIMessage } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"


import { UpgradeApprovalPanel } from "@/features/subscription/ui/upgrade-approval-panel"

interface SupportChatProps {
    ticket: any
    onBack: () => void
}

export function SupportChat({ ticket, onBack }: SupportChatProps) {
    const [messages, setMessages] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [newContent, setNewContent] = useState("")
    const [isSending, setIsSending] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    // ── PlentyAI Assistant ────────────────────────────────────────────────────
    const [aiOpen, setAiOpen] = useState(false)
    const [aiInput, setAiInput] = useState("")
    const aiScrollRef = useRef<HTMLDivElement>(null)
    const { messages: aiMessages, sendMessage, status: aiStatus } = useChat({
        transport: new DefaultChatTransport({ api: "/api/ai/support" }),
        onError: () => toast.error("PlentyAI no está disponible en este momento."),
    })
    const aiLoading = aiStatus === "streaming" || aiStatus === "submitted"

    const handleAiSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!aiInput.trim() || aiLoading) return
        sendMessage({ role: "user", parts: [{ type: "text", text: aiInput }] })
        setAiInput("")
    }

    const fillAiInput = (text: string) => setAiInput(text)

    // Scroll al último mensaje AI automáticamente
    useEffect(() => {
        if (aiScrollRef.current) {
            aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight
        }
    }, [aiMessages])

    const fetchMessages = () => {
        // Implement message fetching logic here if needed
    }

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault()
        if (!newContent.trim()) return
        setIsSending(true)
        setTimeout(() => {
            setIsSending(false)
            setNewContent("")
        }, 500)
    }

    // Detect upgrade request
    const isUpgradeRequest = ticket.metadata &&
        ticket.metadata.type === "UPGRADE_REQUEST" &&
        ticket.status !== "CLOSED"

    return (
        <>
        <div className="flex flex-col h-[600px] bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-2xl">
            {/* Chat Header */}
            {/* ... existing header code ... */}
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">
                            {ticket.subject}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-zinc-400 font-medium">#{ticket.id.substring(ticket.id.length - 6).toUpperCase()}</span>
                            <span className="h-1 w-1 rounded-full bg-zinc-300" />
                            <span className="text-[10px] text-zinc-500 font-bold uppercase">{ticket.status}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-6 scroll-smooth"
            >
                {/* Upgrade Approval Panel */}
                {isUpgradeRequest && (
                    <UpgradeApprovalPanel
                        ticketId={ticket.id}
                        clientId={ticket.user?.clientId}
                        metadata={ticket.metadata}
                        onProcessed={() => {
                            fetchMessages() // Refresh messages to see status update
                            onBack() // Or stay, but usually done
                        }}
                    />
                )}

                {/* Original Ticket Description */}
                <div className="flex gap-4">
                    <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-zinc-500" />
                    </div>
                    <div className="space-y-1 max-w-[80%]">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-tighter">{ticket.user?.name}</span>
                            <span className="text-[10px] text-zinc-400">{format(new Date(ticket.createdAt), "HH:mm", { locale: es })}</span>
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl rounded-tl-none border border-zinc-100 dark:border-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                            {ticket.description}
                        </div>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex gap-4 ${msg.isAdmin ? 'flex-row-reverse' : ''}`}
                        >
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${msg.isAdmin ? 'bg-black text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                                }`}>
                                {msg.isAdmin ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
                            </div>
                            <div className={`space-y-1 max-w-[80%] ${msg.isAdmin ? 'items-end' : ''}`}>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black uppercase tracking-tighter">
                                        {msg.isAdmin ? "Soporte Técnico" : msg.user?.name}
                                    </span>
                                    <span className="text-[10px] text-zinc-400">{format(new Date(msg.createdAt), "HH:mm", { locale: es })}</span>
                                </div>
                                <div className={`p-4 text-sm whitespace-pre-wrap ${msg.isAdmin
                                    ? 'bg-black text-white rounded-2xl rounded-tr-none'
                                    : 'bg-white dark:bg-zinc-900 rounded-2xl rounded-tl-none border border-zinc-100 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <form onSubmit={handleSendMessage} className="relative">
                    <Textarea
                        placeholder="Escribe tu respuesta..."
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSendMessage(e as any)
                            }
                        }}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 rounded-2xl pr-14 min-h-[60px] max-h-[150px] focus:ring-0 focus:border-zinc-400 resize-none transition-all"
                    />
                    <button
                        type="submit"
                        disabled={isSending || !newContent.trim()}
                        className="absolute right-3 bottom-3 p-2 bg-black text-white rounded-xl hover:scale-110 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all shadow-lg"
                    >
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                </form>
                <p className="text-[10px] text-zinc-400 mt-2 text-center font-medium">
                    Presiona Enter para enviar. Shift + Enter para nueva línea.
                </p>
            </div>
        </div>

        {/* ── PlentyAI Assistant Panel ──────────────────────────────────────── */}
        <div className="mt-4 rounded-3xl border border-violet-200 dark:border-violet-900/50 overflow-hidden shadow-lg shadow-violet-500/5">
            {/* Toggle header */}
            <button
                onClick={() => setAiOpen(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 hover:from-violet-100 hover:to-indigo-100 dark:hover:from-violet-950/60 dark:hover:to-indigo-950/60 transition-all"
            >
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-violet-500 rounded-lg">
                        <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-black text-violet-900 dark:text-violet-100 tracking-tight">PlentyAI</p>
                        <p className="text-[10px] text-violet-500 dark:text-violet-400 font-medium uppercase tracking-widest">Asistente inteligente</p>
                    </div>
                </div>
                {aiOpen
                    ? <ChevronUp className="h-4 w-4 text-violet-400" />
                    : <ChevronDown className="h-4 w-4 text-violet-400" />}
            </button>

            {/* Chat AI */}
            {aiOpen && (
                <div className="bg-white dark:bg-zinc-950">
                    {/* Messages */}
                    <div
                        ref={aiScrollRef}
                        className="h-64 overflow-y-auto p-5 space-y-4 scroll-smooth"
                    >
                        {aiMessages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                                <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-2xl">
                                    <Bot className="h-6 w-6 text-violet-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Pregúntame algo sobre tu ticket</p>
                                    <p className="text-[11px] text-zinc-400 mt-1">
                                        Conozco tus facturas recientes, errores HKA y el sistema PlentyPay.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2 justify-center mt-2">
                                    {[
                                        "¿Por qué fue rechazada mi factura?",
                                        "¿Qué es el CUFE?",
                                        "¿Cómo emito una Nota de Crédito?",
                                    ].map(q => (
                                        <button
                                            key={q}
                                            onClick={() => fillAiInput(q)}
                                            className="text-[10px] px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-full border border-violet-200 dark:border-violet-800 font-medium hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {aiMessages.map((msg: UIMessage) => (
                            <div
                                key={msg.id}
                                className={`flex gap-3 ${
                                    msg.role === "assistant" ? "flex-row" : "flex-row-reverse"
                                }`}
                            >
                                <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                                    msg.role === "assistant"
                                        ? "bg-violet-500 text-white"
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                                }`}>
                                    {msg.role === "assistant"
                                        ? <Sparkles className="h-3.5 w-3.5" />
                                        : <User className="h-3.5 w-3.5" />}
                                </div>
                                <div className={`max-w-[80%] text-sm px-4 py-2.5 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                                    msg.role === "assistant"
                                        ? "bg-violet-50 dark:bg-violet-950/50 text-zinc-800 dark:text-zinc-200 rounded-tl-none border border-violet-100 dark:border-violet-900/50"
                                        : "bg-zinc-900 dark:bg-zinc-800 text-white rounded-tr-none"
                                }`}>
                                    {msg.parts
                                        .filter((p) => p.type === "text")
                                        .map((p) => (p as { type: "text"; text: string }).text)
                                        .join("")}
                                </div>
                            </div>
                        ))}

                        {aiLoading && (
                            <div className="flex gap-3">
                                <div className="h-7 w-7 rounded-full bg-violet-500 flex items-center justify-center shrink-0">
                                    <Sparkles className="h-3.5 w-3.5 text-white animate-pulse" />
                                </div>
                                <div className="bg-violet-50 dark:bg-violet-950/50 border border-violet-100 dark:border-violet-900/50 px-4 py-2.5 rounded-2xl rounded-tl-none">
                                    <div className="flex gap-1">
                                        <span className="h-1.5 w-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
                                        <span className="h-1.5 w-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
                                        <span className="h-1.5 w-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:300ms]" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input AI */}
                    <div className="px-5 pb-5 border-t border-violet-100 dark:border-violet-900/30 pt-4">
                        <form onSubmit={handleAiSubmit} className="relative">
                            <input
                                id="ai-support-input"
                                value={aiInput}
                                onChange={(e) => setAiInput(e.target.value)}
                                disabled={aiLoading}
                                placeholder="Pregúntale a PlentyAI sobre tu ticket..."
                                className="w-full bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-xl px-4 py-3 pr-12 text-sm outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-600 transition-all placeholder:text-violet-300 dark:placeholder:text-violet-700 text-zinc-800 dark:text-zinc-200"
                            />
                            <button
                                type="submit"
                                disabled={aiLoading || !aiInput.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                            >
                                {aiLoading
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Send className="h-3.5 w-3.5" />}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    </>
    )
}
