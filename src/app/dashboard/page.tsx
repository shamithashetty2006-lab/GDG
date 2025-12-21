"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { FileText, Plus, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export default function DashboardPage() {
    const { user } = useAuth();
    const router = useRouter();

    // Mock data for now
    const documents = [
        { id: "1", name: "Service Agreement.pdf", date: new Date(), status: "Analyzed" },
        { id: "2", name: "NDA_V1.pdf", date: new Date(), status: "Pending" },
    ];

    const handleSignOut = async () => {
        await signOut(auth);
        router.push("/login"); // or root
    };

    if (!user) {
        // Auth provider might not have redirected yet
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="mx-auto max-w-5xl space-y-8">
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                        <p className="text-muted-foreground">
                            Welcome back, {user.displayName}
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={handleSignOut}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Sign Out
                        </Button>
                        <Link href="/analyze">
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                New Analysis
                            </Button>
                        </Link>
                    </div>
                </header>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="col-span-full">
                        <CardHeader>
                            <CardTitle>Recent Documents</CardTitle>
                            <CardDescription>
                                Your recently uploaded and analyzed contracts.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {documents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                    <FileText className="h-12 w-12 opacity-20" />
                                    <p className="mt-2 text-sm">No documents found.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {documents.map((doc) => (
                                        <div
                                            key={doc.id}
                                            className="flex items-center justify-between rounded-lg border p-4"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="rounded-full bg-primary/10 p-2 text-primary">
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">{doc.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {format(doc.date, "PPP")}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-sm text-muted-foreground">
                                                    {doc.status}
                                                </span>
                                                <Button variant="ghost" size="sm">
                                                    View
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
