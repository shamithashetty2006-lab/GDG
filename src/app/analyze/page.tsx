"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, AlertTriangle, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/components/auth-provider";

export default function AnalyzePage() {
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const analyzeDocument = async () => {
        if (!file) return;

        setAnalyzing(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);

            reader.onload = async () => {
                const base64String = reader.result as string;
                const base64Token = base64String.split(",")[1];

                const res = await fetch("/api/analyze", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        base64: base64Token,
                        mimeType: file.type
                    }),
                });

                const data = await res.json();
                setResult(data);

                // Save to Firestore
                if (user) {
                    try {
                        setSaving(true);
                        await addDoc(collection(db, "contracts"), {
                            userId: user.uid,
                            fileName: file.name,
                            fileType: file.type,
                            uploadedAt: serverTimestamp(),
                            summary: data.summary,
                            score: data.score,
                            key_details: data.key_details || [],
                            risks: data.risks || [],
                            status: "Analyzed"
                        });
                    } catch (err) {
                        console.error("Error saving result:", err);
                    } finally {
                        setSaving(false);
                    }
                }

                setAnalyzing(false);
            };

            reader.onerror = () => {
                alert("Failed to read file");
                setAnalyzing(false);
            }
        } catch (error) {
            console.error("Analysis failed", error);
            alert("Analysis failed. See console.");
            setAnalyzing(false);
        }
    };

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="mx-auto max-w-4xl space-y-8">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold tracking-tight">New Analysis</h1>
                </div>

                {!result ? (
                    <Card className="border-2 border-dashed border-muted-foreground/25">
                        <CardContent className="flex flex-col items-center justify-center space-y-4 py-12">
                            <div className="rounded-full bg-primary/10 p-4">
                                <Upload className="h-8 w-8 text-primary" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-semibold">Upload Contract</h3>
                                <p className="text-sm text-muted-foreground">
                                    Drag and drop or click to upload (PDF, TXT)
                                </p>
                            </div>
                            <input
                                type="file"
                                accept=".txt,.md,.pdf,image/*"
                                className="hidden"
                                id="file-upload"
                                onChange={handleFileChange}
                            />
                            <label htmlFor="file-upload">
                                <Button variant="outline" asChild className="cursor-pointer">
                                    <span>{file ? file.name : "Select File"}</span>
                                </Button>
                            </label>

                            {file && (
                                <Button onClick={analyzeDocument} disabled={analyzing}>
                                    {analyzing ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Analyzing...
                                        </>
                                    ) : (
                                        "Start Analysis"
                                    )}
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    Analysis Results
                                    <span className={cn(
                                        "rounded-full px-3 py-1 text-sm font-medium",
                                        result.score > 80 ? "bg-green-100 text-green-700" :
                                            result.score > 50 ? "bg-yellow-100 text-yellow-700" :
                                                "bg-red-100 text-red-700"
                                    )}>
                                        Safety Score: {result.score}/100
                                    </span>
                                </CardTitle>
                                <CardDescription>{result.summary}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {result.key_details && (
                                        <div className="rounded-lg bg-muted/50 p-4">
                                            <h4 className="mb-2 font-semibold">Key Details</h4>
                                            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                                                {result.key_details.map((detail: string, i: number) => (
                                                    <li key={i}>{detail}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        <h4 className="font-semibold">Identified Risks</h4>
                                        {result.risks?.map((risk: any, i: number) => (
                                            <div key={i} className="flex gap-4 rounded-lg border p-4">
                                                <AlertTriangle className={cn(
                                                    "h-5 w-5 shrink-0",
                                                    risk.severity === "High" ? "text-red-500" :
                                                        risk.severity === "Medium" ? "text-yellow-500" : "text-blue-500"
                                                )} />
                                                <div>
                                                    <p className="font-medium">{risk.clause}</p>
                                                    <p className="text-sm text-muted-foreground">{risk.explanation}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <div className="flex justify-end gap-4">
                            <Button variant="outline" onClick={() => setResult(null)}>Analyze Another</Button>
                            <Button>Save Report</Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
