"use client";

import Link from "next/link";
import { useAuth } from "./auth-provider";
import { Button } from "./ui/button";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Home, LogOut, Shield } from "lucide-react";

export function Navbar() {
    const { user } = useAuth();
    const router = useRouter();

    const handleSignOut = async () => {
        await signOut(auth);
        router.push("/");
    };

    return (
        <nav className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-2">
                        <Shield className="h-8 w-8 text-primary" />
                        <span className="text-xl font-bold tracking-tight text-gray-900">ClearSign</span>
                    </Link>

                    <div className="hidden md:flex md:items-center md:gap-6">
                        <Link
                            href="/"
                            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-primary"
                        >
                            <Home className="h-4 w-4" />
                            Home
                        </Link>
                        {user && (
                            <Link
                                href="/dashboard"
                                className="flex items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-primary"
                            >
                                <LayoutDashboard className="h-4 w-4" />
                                Dashboard
                            </Link>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {user ? (
                        <>
                            <span className="hidden text-sm text-gray-500 lg:inline-block">
                                {user.displayName || user.email}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSignOut}
                                className="text-gray-600 hover:text-red-600"
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                Sign Out
                            </Button>
                        </>
                    ) : (
                        <Link href="/login">
                            <Button size="sm">Sign In</Button>
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
