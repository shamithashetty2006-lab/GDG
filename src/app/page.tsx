import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Zap, FileText } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center px-4 lg:px-6">
        <Link className="flex items-center justify-center font-bold" href="#">
          <ShieldCheck className="mr-2 h-6 w-6 text-primary" />
          <span className="text-xl">ClearSign</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link
            className="text-sm font-medium underline-offset-4 hover:underline"
            href="/login"
          >
            Sign In
          </Link>
          <Link
            className="text-sm font-medium underline-offset-4 hover:underline"
            href="#"
          >
            Features
          </Link>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Analyze Contracts with AI Precision
                </h1>
                <p className="mx-auto max-w-[700px] text-zinc-500 dark:text-zinc-400 md:text-xl">
                  Identify risks, dangerous clauses, and get simplified explanations in seconds.
                  Protect your business with ClearSign.
                </p>
              </div>
              <div className="space-y-2">
                <Link href="/login">
                  <Button size="lg" className="h-12 px-8">
                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full bg-zinc-100 py-12 dark:bg-zinc-800 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Instant Analysis</h2>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Get results in seconds. Our AI scans every line to find hidden risks.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Simplified Summaries</h2>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Understand complex legal jargon with plain English explanations.
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Risk Scoring</h2>
                <p className="text-zinc-500 dark:text-zinc-400">
                  Get a clear safety score for every document before you sign.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex w-full shrink-0 flex-col items-center gap-2 border-t py-6 sm:flex-row md:px-6">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          © 2024 ClearSign Inc. All rights reserved.
        </p>
        <nav className="flex gap-4 sm:ml-auto sm:gap-6">
          <Link className="text-xs underline-offset-4 hover:underline" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs underline-offset-4 hover:underline" href="#">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  );
}
