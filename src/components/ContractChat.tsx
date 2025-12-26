"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Send, X, Loader2, Bot, User, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface ContractChatProps {
    contractText: string;
    isOpen: boolean;
    onClose: () => void;
}

export function ContractChat({ contractText, isOpen, onClose }: ContractChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage: Message = { role: "user", content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMessage],
                    contractText
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Server error: ${res.status}`);
            }

            const data = await res.json();
            setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
        } catch (err: any) {
            console.error("Chat Error:", err);
            setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-[400px] animate-in slide-in-from-bottom-4">
            <Card className="shadow-2xl border-primary/20 flex flex-col h-[500px]">
                <CardHeader className="p-4 border-b bg-primary text-primary-foreground flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Contract Assistant
                    </CardTitle>
                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-white hover:bg-white/20"
                            onClick={() => setMessages([])}
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-white hover:bg-white/20"
                            onClick={onClose}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50" ref={scrollRef}>
                    {messages.length === 0 && (
                        <div className="text-center py-8 space-y-2">
                            <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                                <Bot className="w-6 h-6 text-primary" />
                            </div>
                            <p className="text-sm font-medium text-gray-900">How can I help you today?</p>
                            <p className="text-xs text-muted-foreground px-4">
                                Ask me about specific clauses, dates, or obligations in your contract.
                            </p>
                        </div>
                    )}

                    {messages.map((m, i) => (
                        <div key={i} className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "")}>
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                m.role === "assistant" ? "bg-primary text-white" : "bg-gray-200 text-gray-600"
                            )}>
                                {m.role === "assistant" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                            </div>
                            <div className={cn(
                                "rounded-2xl px-4 py-2 text-sm max-w-[80%] shadow-sm",
                                m.role === "assistant" ? "bg-white text-gray-900" : "bg-blue-600 text-white"
                            )}>
                                {m.content}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">
                                <Bot className="w-4 h-4" />
                            </div>
                            <div className="bg-white rounded-2xl px-4 py-3 text-sm shadow-sm flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                Thinking...
                            </div>
                        </div>
                    )}
                </CardContent>

                <div className="p-4 border-t bg-white">
                    <form
                        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        className="flex gap-2"
                    >
                        <input
                            type="text"
                            placeholder="Type your question..."
                            className="flex-1 bg-gray-100 border-none px-3 py-2 text-sm rounded-full focus:ring-2 focus:ring-primary focus:outline-none"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={loading || !input.trim()}
                            className="rounded-full h-9 w-9 bg-primary"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">
                        AI can make mistakes. Please verify important information.
                    </p>
                </div>
            </Card>
        </div>
    );
}
