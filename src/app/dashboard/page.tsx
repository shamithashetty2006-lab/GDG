"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { FileText, Plus, LogOut, Loader2, ArrowLeft, CheckCircle, AlertTriangle, Trash2, MessageSquare, Handshake, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { generateContractReport } from "@/lib/pdf-gen";
import { ContractChat } from "@/components/ContractChat";

export default function DashboardPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [documents, setDocuments] = useState<any[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState<'contract' | 'summary' | 'risks'>('summary');
    const [loading, setLoading] = useState(true);
    const [plainEnglish, setPlainEnglish] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [negotiatingId, setNegotiatingId] = useState<number | null>(null);
    const [negotiationResults, setNegotiationResults] = useState<Record<number, any>>({});
    const [expandedNegotiation, setExpandedNegotiation] = useState<number | null>(null);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "contracts"),
            where("userId", "==", user.uid),
            orderBy("uploadedAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                uploadedAt: doc.data().uploadedAt?.toDate() || new Date()
            }));
            setDocuments(docs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleSignOut = async () => {
        await signOut(auth);
        router.push("/login");
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this analysis? This action cannot be undone.")) {
            return;
        }

        try {
            await deleteDoc(doc(db, "contracts", id));
            if (selectedDoc?.id === id) {
                setSelectedDoc(null);
            }
        } catch (err) {
            console.error("Failed to delete document:", err);
            alert("Failed to delete the document. Please try again.");
        }
    };

    const handleNegotiate = async (risk: any, index: number) => {
        if (negotiationResults[index]) {
            setExpandedNegotiation(expandedNegotiation === index ? null : index);
            return;
        }

        setNegotiatingId(index);
        try {
            const res = await fetch("/api/negotiate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clause: risk.clause,
                    explanation: risk.explanation,
                    context: selectedDoc?.summary
                }),
            });

            if (!res.ok) throw new Error("Negotiation failed");
            const data = await res.json();
            setNegotiationResults(prev => ({ ...prev, [index]: data }));
            setExpandedNegotiation(index);
        } catch (err) {
            console.error("Negotiation error:", err);
            alert("Failed to generate negotiation strategy.");
        } finally {
            setNegotiatingId(null);
        }
    };

    if (!user) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const avgScore = documents.length > 0
        ? Math.round(documents.reduce((acc: number, doc: any) => acc + (doc.score || 0), 0) / documents.length)
        : 0;

    const highRiskCount = documents.reduce((acc: number, doc: any) =>
        acc + (doc.risks?.filter((r: any) => r.severity === "High").length || 0), 0
    );

    return (
        <div className="min-h-screen bg-gray-50/50 p-4 md:p-8">
            <div className="mx-auto max-w-7xl space-y-8">
                {/* Header */}
                <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Contract Center</h1>
                        <p className="text-muted-foreground">Manage and analyze your legal documents</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={handleSignOut} className="bg-white">
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign Out
                        </Button>
                        <Link href="/analyze">
                            <Button className="bg-primary hover:bg-primary/90">
                                <Plus className="mr-2 h-4 w-4" />
                                New Analysis
                            </Button>
                        </Link>
                    </div>
                </header>

                {/* Summary Cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Card className="border-none shadow-sm transition-hover hover:shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Average Risk Score</CardTitle>
                            <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                                <CheckCircle className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{avgScore}%</div>
                            <p className="text-xs text-muted-foreground mt-1">Overall contract safety average</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm transition-hover hover:shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">High Risk Clauses</CardTitle>
                            <div className="rounded-full bg-red-50 p-2 text-red-600">
                                <AlertTriangle className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{highRiskCount}</div>
                            <p className="text-xs text-muted-foreground mt-1">Critical issues across {documents.length} files</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm transition-hover hover:shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Documents</CardTitle>
                            <div className="rounded-full bg-green-50 p-2 text-green-600">
                                <FileText className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{documents.length}</div>
                            <p className="text-xs text-muted-foreground mt-1">Total analyzed contracts</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-12">
                    {/* Document List */}
                    <div className={cn("lg:col-span-4 space-y-4", selectedDoc ? "hidden lg:block" : "lg:col-span-12")}>
                        <Card className="border-none shadow-sm overflow-hidden h-full">
                            <CardHeader className="bg-white border-b pb-4">
                                <CardTitle className="text-lg">Recent Documents</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground opacity-20" />
                                    </div>
                                ) : documents.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <FileText className="h-12 w-12 text-gray-200" />
                                        <p className="mt-2 text-sm text-muted-foreground">No documents uploaded yet</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {documents.map((doc) => (
                                            <div
                                                key={doc.id}
                                                onClick={() => setSelectedDoc(doc)}
                                                className={cn(
                                                    "flex items-center justify-between p-4 cursor-pointer transition-colors hover:bg-gray-50",
                                                    selectedDoc?.id === doc.id ? "bg-primary/5 border-l-4 border-primary" : "border-l-4 border-transparent"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "rounded-lg p-2",
                                                        doc.score > 80 ? "bg-green-100 text-green-700" :
                                                            doc.score > 50 ? "bg-yellow-100 text-yellow-700" :
                                                                "bg-red-100 text-red-700"
                                                    )}>
                                                        <FileText className="h-5 w-5" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="font-semibold text-sm truncate max-w-[150px]">{doc.fileName}</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                                            {format(doc.uploadedAt, "MMM d, yyyy")}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={cn(
                                                        "text-xs font-bold px-2 py-1 rounded",
                                                        doc.score > 80 ? "text-green-600 bg-green-50" :
                                                            doc.score > 50 ? "text-yellow-600 bg-yellow-50" :
                                                                "text-red-600 bg-red-50"
                                                    )}>
                                                        {doc.score}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detail View */}
                    {selectedDoc && (
                        <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[700px]">
                            {/* Detail Header */}
                            <div className="p-4 border-b flex items-center justify-between bg-white sticky top-0 z-10">
                                <div className="flex items-center gap-4">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="lg:hidden"
                                        onClick={() => setSelectedDoc(null)}
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                    </Button>
                                    <div>
                                        <h2 className="text-lg font-bold truncate max-w-[200px] sm:max-w-md">{selectedDoc.fileName}</h2>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>Analyzed on {format(selectedDoc.uploadedAt, "PPP")}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex p-0.5 bg-gray-100 rounded-lg">
                                        <button
                                            onClick={() => setActiveTab('summary')}
                                            className={cn(
                                                "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
                                                activeTab === 'summary' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                            )}
                                        >
                                            Summary
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('risks')}
                                            className={cn(
                                                "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
                                                activeTab === 'risks' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                            )}
                                        >
                                            Risks
                                        </button>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                                        onClick={(e) => handleDelete(selectedDoc.id, e)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Plain English Toggle Banner */}
                            <div className="bg-primary/5 px-6 py-2 border-b flex items-center justify-between">
                                <span className="text-xs font-medium text-primary flex items-center gap-1.5">
                                    <CheckCircle className="h-3 w-3" />
                                    Ethical Analysis Active
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-bold text-gray-400">Legal Jargon</span>
                                    <button
                                        onClick={() => setPlainEnglish(!plainEnglish)}
                                        className={cn(
                                            "w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ease-in-out",
                                            plainEnglish ? "bg-primary" : "bg-gray-300"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-3 h-3 bg-white rounded-full transition-transform duration-200",
                                            plainEnglish ? "translate-x-4" : "translate-x-0"
                                        )} />
                                    </button>
                                    <span className="text-[10px] uppercase font-bold text-primary">Plain English</span>
                                </div>
                            </div>

                            {/* Detail Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {activeTab === 'summary' ? (
                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <h3 className="font-bold text-gray-900">Document Summary</h3>
                                            <p className="text-gray-600 leading-relaxed text-sm">
                                                {selectedDoc.summary}
                                            </p>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                                                <h4 className="text-blue-900 text-xs font-black uppercase tracking-tighter mb-2">Key Parties & Entities</h4>
                                                <ul className="text-sm text-blue-800 space-y-1">
                                                    {selectedDoc.key_details?.map((detail: string, i: number) => (
                                                        <li key={i} className="flex items-start gap-2">
                                                            <div className="h-1 w-1 rounded-full bg-blue-400 mt-2 shrink-0" />
                                                            {detail}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* Heatmap visualization */}
                                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                                <h3 className="text-[10px] font-black uppercase tracking-tighter text-gray-500 mb-3">Risk Distribution Heatmap</h3>
                                                <div className="flex gap-1.5 h-16 items-end">
                                                    {[...Array(10)].map((_, i) => {
                                                        const docRisks = selectedDoc.risks || [];
                                                        const riskLevel = docRisks.length > i ? (docRisks[i].severity === 'High' ? 'bg-red-500' : docRisks[i].severity === 'Medium' ? 'bg-yellow-400' : 'bg-blue-400') : 'bg-gray-200';
                                                        const height = docRisks.length > i ? (docRisks[i].severity === 'High' ? 'h-full' : docRisks[i].severity === 'Medium' ? 'h-3/4' : 'h-1/2') : 'h-1/4';
                                                        return (
                                                            <div key={i} className={cn("flex-1 rounded-sm transition-all animate-in fade-in slide-in-from-bottom-2", riskLevel, height)} style={{ animationDelay: `${i * 50}ms` }} />
                                                        );
                                                    })}
                                                </div>
                                                <div className="mt-2 flex justify-between text-[8px] font-bold text-gray-400 uppercase">
                                                    <span>Start</span>
                                                    <span>End of Document</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Category Breakdown */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {Array.from(new Set((selectedDoc.risks || []).map((r: any) => r.category || "General"))).map((cat: any, i: number) => (
                                                <div key={i} className="bg-white border text-center p-2 rounded-lg">
                                                    <p className="text-[8px] font-bold text-gray-400 uppercase">{cat}</p>
                                                    <p className="text-xs font-black text-gray-900">
                                                        {(selectedDoc.risks || []).filter((r: any) => (r.category || "General") === cat).length}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-gray-900">Critical Risks Identified</h3>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Showing {selectedDoc.risks?.length || 0} items</span>
                                        </div>
                                        <div className="grid gap-4">
                                            {selectedDoc.risks?.map((risk: any, i: number) => (
                                                <div key={i} className={cn(
                                                    "group relative flex flex-col gap-3 rounded-xl border p-4 transition-all hover:shadow-md",
                                                    risk.severity === "High" ? "bg-red-50/30 border-red-100" :
                                                        risk.severity === "Medium" ? "bg-yellow-50/30 border-yellow-100" :
                                                            "bg-blue-50/30 border-blue-100"
                                                )}>
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn(
                                                                "flex-shrink-0 rounded-full p-2 h-fit",
                                                                risk.severity === "High" ? "bg-red-100 text-red-600" :
                                                                    risk.severity === "Medium" ? "bg-yellow-100 text-yellow-600" :
                                                                        "bg-blue-100 text-blue-600"
                                                            )}>
                                                                <AlertTriangle className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-sm text-gray-900">{risk.clause}</p>
                                                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{risk.category || "Other"}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className={cn(
                                                                "text-[10px] uppercase font-black px-1.5 py-0.5 rounded",
                                                                risk.severity === "High" ? "bg-red-200 text-red-800" :
                                                                    risk.severity === "Medium" ? "bg-yellow-200 text-yellow-800" :
                                                                        "bg-blue-200 text-blue-800"
                                                            )}>
                                                                {risk.severity}
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-primary transition-all"
                                                                        style={{ width: `${risk.confidence || 85}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[8px] font-bold text-gray-400">
                                                                    {risk.confidence || 85}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                        <div className="space-y-2">
                                                            <p className="text-sm text-gray-600 italic font-medium leading-relaxed">
                                                                “{plainEnglish ? (risk.simple_explanation || risk.explanation) : risk.explanation}”
                                                            </p>

                                                            {risk.impact && (
                                                                <div className="flex gap-2 items-start bg-white/50 p-2 rounded-lg border border-dashed">
                                                                    <div className="text-[10px] font-black uppercase text-red-500 mt-0.5 shrink-0">Impact:</div>
                                                                    <p className="text-xs text-gray-600 leading-tight">{risk.impact}</p>
                                                                </div>
                                                            )}

                                                            <div className="flex items-center gap-2 pt-1 border-t border-dashed mt-2">
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Who Benefits:</span>
                                                                <span className={cn(
                                                                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                                                    risk.who_benefits === "User" ? "bg-green-100 text-green-700" :
                                                                        risk.who_benefits === "Company" ? "bg-red-100 text-red-700" :
                                                                            "bg-gray-100 text-gray-600"
                                                                )}>
                                                                    {risk.who_benefits || "Neutral"}
                                                                </span>
                                                            </div>

                                                            {/* Negotiation Strategy Section */}
                                                            <div className="mt-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className={cn(
                                                                        "h-7 text-[10px] font-bold gap-1.5 transition-all",
                                                                        negotiationResults[i] ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100" : "border-primary/20 text-primary hover:bg-primary/5"
                                                                    )}
                                                                    onClick={() => handleNegotiate(risk, i)}
                                                                    disabled={negotiatingId === i}
                                                                >
                                                                    {negotiatingId === i ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                    ) : (
                                                                        <Handshake className="h-3 w-3" />
                                                                    )}
                                                                    {negotiationResults[i] ? (expandedNegotiation === i ? "Hide Negotiation" : "View Negotiation") : "Negotiate Clause"}
                                                                    {negotiationResults[i] && (expandedNegotiation === i ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                                                                </Button>

                                                                {expandedNegotiation === i && negotiationResults[i] && (
                                                                    <div className="mt-3 p-4 bg-green-50/50 rounded-xl border border-green-200 animate-in fade-in slide-in-from-top-2">
                                                                        <div className="space-y-3">
                                                                            <div>
                                                                                <p className="text-[10px] font-black text-green-800 uppercase mb-1">Suggested Safer Clause</p>
                                                                                <p className="text-sm text-gray-900 bg-white p-3 rounded-lg border border-green-100 italic leading-relaxed">
                                                                                    “{negotiationResults[i].suggested_clause}”
                                                                                </p>
                                                                            </div>
                                                                            <div className="grid sm:grid-cols-2 gap-3">
                                                                                <div className="bg-white/60 p-2.5 rounded-lg border border-green-100">
                                                                                    <p className="text-[9px] font-black text-green-800 uppercase mb-1">Why It's Better</p>
                                                                                    <p className="text-xs text-gray-700">{negotiationResults[i].why_it_is_better}</p>
                                                                                </div>
                                                                                <div className="bg-white/60 p-2.5 rounded-lg border border-green-100">
                                                                                    <p className="text-[9px] font-black text-green-800 uppercase mb-1">Negotiation Tip</p>
                                                                                    <p className="text-xs text-gray-700">{negotiationResults[i].negotiation_tip}</p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Detail Footer */}
                            <div className="p-4 border-t bg-gray-50 flex items-center justify-between text-xs text-muted-foreground">
                                <span>Risk Scoring Engine v2.1 (OpenAI Enabled)</span>
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="h-auto p-0 font-bold text-primary hover:text-primary/80"
                                    onClick={() => generateContractReport(selectedDoc, selectedDoc.fileName)}
                                >
                                    Generate PDF Report
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Button
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-40 group overflow-hidden transition-all hover:w-40"
                onClick={() => setIsChatOpen(!isChatOpen)}
            >
                <div className="flex items-center gap-3">
                    <MessageSquare className="h-6 w-6 shrink-0" />
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity font-bold whitespace-nowrap">Chat Assistant</span>
                </div>
            </Button>

            <ContractChat
                contractText={selectedDoc ? JSON.stringify(selectedDoc) : "No document selected"}
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
            />
        </div >
    );
}
