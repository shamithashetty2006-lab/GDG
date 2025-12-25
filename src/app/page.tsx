"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, ArrowRight, AlertTriangle, LayoutDashboard, Loader2, Volume2, VolumeX, Languages, CheckCircle2, Info, HelpCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { generateContractReport } from "@/lib/pdf-gen";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useSpeech } from "@/hooks/use-speech";
import { useSTT } from "@/hooks/use-stt";
import { useEffect as useReactEffect } from "react";

const LANGUAGES = [
  { label: "English", value: "English", code: "en-US" },
  { label: "Hindi", value: "Hindi", code: "hi-IN" },
  { label: "Marathi", value: "Marathi", code: "mr-IN" },
  { label: "Punjabi", value: "Punjabi", code: "pa-IN" },
  { label: "Kannada", value: "Kannada", code: "kn-IN" },
  { label: "Gujarati", value: "Gujarati", code: "gu-IN" },
  { label: "Tamil", value: "Tamil", code: "ta-IN" },
  { label: "Telugu", value: "Telugu", code: "te-IN" },
];

export default function HomePage() {
  const { user } = useAuth();
  const { speak, stop, isSpeaking } = useSpeech();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [translatedResult, setTranslatedResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'explain'>('analysis');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [plainEnglish, setPlainEnglish] = useState(false);
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [translating, setTranslating] = useState(false);
  const { isListening, transcript, error: sttError, supported: sttSupported, startListening, setTranscript: setSttTranscript } = useSTT();

  useReactEffect(() => {
    if (transcript) {
      setText(prev => prev + (prev ? " " : "") + transcript);
      setSttTranscript("");
    }
  }, [transcript, setSttTranscript]);

  const displayResult = translatedResult || result;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const translateResult = async (lang: typeof LANGUAGES[0]) => {
    if (!result || lang.value === "English") {
      setTranslatedResult(null);
      return;
    }

    setTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: result,
          targetLanguage: lang.value,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Translation failed");
      }
      const data = await res.json();
      setTranslatedResult(data);
    } catch (err: any) {
      console.error("Translation error:", err);
      // Fallback: reset translated result if it fails
      setTranslatedResult(null);
      alert(`Translation failed: ${err.message}`);
    } finally {
      setTranslating(false);
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = LANGUAGES.find(l => l.value === e.target.value) || LANGUAGES[0];
    setSelectedLang(lang);
    translateResult(lang);
  };

  const analyze = async (payload: { base64: string; mimeType: string }) => {
    setAnalyzing(true);
    setResult(null);
    setTranslatedResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Analysis failed (Status: ${res.status})`);
      }

      const data = await res.json();
      setResult(data);

      // Save to Firestore if user is logged in
      if (user) {
        try {
          await addDoc(collection(db, "contracts"), {
            userId: user.uid,
            fileName: file?.name || "Pasted Contract Content",
            uploadedAt: serverTimestamp(),
            summary: data.summary,
            score: data.score,
            risks: data.risks || [],
            key_details: data.key_details || [],
            analysis_source: data.analysis_source
          });
          setSaveStatus("Saved to your dashboard history.");
        } catch (saveErr) {
          console.error("Failed to save to history:", saveErr);
          setSaveStatus("Analysis complete, but failed to save to history.");
        }
      } else {
        setSaveStatus("Sign in to save this analysis to your history.");
      }

      console.log("Analysis result:", data);
    } catch (err: any) {
      console.error(err);
      setSaveStatus(err.message || "An error occurred during analysis.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64String = reader.result as string;
      const base64 = base64String.split(",")[1];
      await analyze({ base64, mimeType: file.type });
    };
  };

  const handlePaste = async () => {
    if (!text) return;
    const base64 = btoa(encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (match, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    ));
    await analyze({ base64, mimeType: "text/plain" });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="mb-8 flex flex-col items-center gap-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
          AI‑Powered Contract Risk Highlighting
        </h1>
        <div className="flex gap-4">
          <Link href="/dashboard">
            <Button variant="outline" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      <div id="upload-section" className="grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="p-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Upload Contract
                <div className="group relative">
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl z-50">
                    Upload your contract in PDF, DOCX, or Image format for AI analysis.
                  </div>
                </div>
              </CardTitle>
              {result && file && (
                <div className="flex items-center gap-1 text-green-600 text-xs font-bold animate-in fade-in slide-in-from-right-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Analysis Completed
                </div>
              )}
            </div>
            <CardDescription>Supported formats: PDF, DOCX, TXT, images</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <label className="flex cursor-pointer items-center justify-center rounded border border-dashed p-8">
              <Upload className="mr-2 h-6 w-6" />
              <span>Click or drag file here</span>
              <input type="file" accept="*/*" className="hidden" onChange={handleFileChange} />
            </label>
            <Button
              onClick={handleUpload}
              disabled={!file || analyzing}
              className="mt-4 w-full"
            >
              {analyzing ? "Analyzing…" : "Analyze Uploaded File"}
            </Button>
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Paste Contract Text
              <div className="group relative">
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl z-50">
                  Directly paste the contract text here if you don't have a file.
                </div>
              </div>
            </CardTitle>
            <CardDescription>Copy & paste the contract content directly</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <textarea
                rows={6}
                className="w-full rounded border p-2 pr-10"
                placeholder="Paste contract text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              {sttSupported && (
                <div className="absolute top-2 right-2 flex flex-col items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 w-8 p-0 rounded-full transition-all",
                      isListening ? "bg-red-100 text-red-600 animate-pulse" : "text-gray-400 hover:text-primary"
                    )}
                    onClick={() => isListening ? null : startListening()}
                    disabled={isListening}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                  </Button>
                </div>
              )}
            </div>

            <div className="mt-2 flex flex-col gap-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100 italic">
                <Info className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <p className="text-[11px] text-amber-800 leading-tight">
                  <span className="font-bold">Note:</span> English voice input only. If you speak in other languages, results may be inaccurate or fail. Please use English or manual text entry.
                </p>
              </div>

              {sttError && (
                <p className="text-xs text-red-500 font-medium">{sttError}</p>
              )}

              <Button
                onClick={handlePaste}
                disabled={!text || analyzing}
                className="w-full"
              >
                {analyzing ? "Analyzing…" : "Analyze Text"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="mt-4 text-xs text-gray-600">
        This tool does not provide legal advice.
      </p>

      <div className="mt-8 flex w-full max-w-4xl justify-around">
        <div className="flex flex-col items-center">
          <Upload className="h-8 w-8 text-gray-600" />
          <span className="mt-2 text-sm font-medium">Upload</span>
        </div>
        <div className="flex flex-col items-center">
          <ArrowRight className="h-8 w-8 text-gray-600" />
          <span className="mt-2 text-sm font-medium">Analyze</span>
        </div>
        <div className="flex flex-col items-center">
          <FileText className="h-8 w-8 text-gray-600" />
          <span className="mt-2 text-sm font-medium">Explain</span>
        </div>
      </div>

      <div className="mt-12 w-full max-w-4xl">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <img
              src="https://img.freepik.com/free-photo/business-handshake_23-2151944825.jpg"
              alt="business handshake"
              className="w-full h-64 object-cover sm:rounded-xl"
            />
          </CardContent>
        </Card>
        {result && (
          <div className="mt-12 w-full max-w-4xl">
            <Card id="results-section" className="p-6">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Analysis Result</CardTitle>
                    <CardDescription>
                      {result.analysis_source} — <span className="text-primary italic">{saveStatus}</span>
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Language Selector */}
                    <div id="language-section" className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-lg border group relative">
                      <Languages className="w-4 h-4 text-gray-500" />
                      <select
                        className="bg-transparent text-sm font-medium focus:outline-none"
                        value={selectedLang.value}
                        onChange={handleLanguageChange}
                        disabled={translating}
                      >
                        {LANGUAGES.map(lang => (
                          <option key={lang.value} value={lang.value}>{lang.label}</option>
                        ))}
                      </select>
                      {translating && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                      <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl z-50">
                        Translate the entire analysis into your preferred regional language.
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-primary/5 px-2 py-1 rounded-full border">
                      <span className="text-[9px] font-bold text-gray-400 uppercase">Jargon</span>
                      <button
                        onClick={() => setPlainEnglish(!plainEnglish)}
                        className={cn(
                          "w-7 h-3.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out",
                          plainEnglish ? "bg-primary" : "bg-gray-300"
                        )}
                      >
                        <div className={cn(
                          "w-2.5 h-2.5 bg-white rounded-full transition-transform duration-200",
                          plainEnglish ? "translate-x-3.5" : "translate-x-0"
                        )} />
                      </button>
                      <span className="text-[9px] font-bold text-primary uppercase">Simple</span>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button
                        onClick={() => setActiveTab('analysis')}
                        className={cn(
                          "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                          activeTab === 'analysis'
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        )}
                      >
                        Analysis
                      </button>
                      <button
                        onClick={() => setActiveTab('explain')}
                        className={cn(
                          "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                          activeTab === 'explain'
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        )}
                      >
                        Explain
                      </button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative group">
                  {activeTab === 'analysis' ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-gray-700 leading-relaxed flex-1">
                          {displayResult.summary}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 text-primary hover:text-primary/80"
                          onClick={() => isSpeaking ? stop() : speak(displayResult.summary, selectedLang.code)}
                        >
                          {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          <span className="ml-1 text-xs">{isSpeaking ? "Stop" : "Listen"}</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="flex items-center text-blue-800 font-semibold">
                          <FileText className="w-4 h-4 mr-2" />
                          Detailed Explanation
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-700 hover:text-blue-800 hover:bg-blue-100"
                          onClick={() => isSpeaking ? stop() : speak(displayResult.summary, selectedLang.code)}
                        >
                          {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          <span className="ml-1 text-xs">{isSpeaking ? "Stop" : "Listen"}</span>
                        </Button>
                      </div>
                      <p className="text-blue-900 text-sm leading-relaxed italic">
                        This analysis explains the key legal concepts found in your contract.
                        Review the specifics below to understand your obligations and risks.
                      </p>
                    </div>
                  )}
                </div>

                {displayResult.key_details && displayResult.key_details.length > 0 && (
                  <div>
                    <h4 className="mb-2 font-semibold">Key Details</h4>
                    <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                      {displayResult.key_details.map((d: string, i: number) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {displayResult.risks && displayResult.risks.length > 0 && (
                  <div>
                    <h4 className="mb-2 font-semibold">Risks</h4>
                    {displayResult.risks.map((risk: any, i: number) => (
                      <div key={i} className="flex gap-4 rounded-lg border p-4 bg-white/50 backdrop-blur-sm">
                        <AlertTriangle
                          className={cn(
                            "h-5 w-5 shrink-0",
                            risk.severity === "High"
                              ? "text-red-500"
                              : risk.severity === "Medium"
                                ? "text-yellow-500"
                                : "text-blue-500"
                          )}
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm text-gray-900">{risk.clause}</p>
                              <span className={cn(
                                "text-[10px] uppercase font-black px-1.5 py-0.5 rounded",
                                risk.severity === "High" ? "bg-red-200 text-red-800" :
                                  risk.severity === "Medium" ? "bg-yellow-200 text-yellow-800" :
                                    "bg-blue-200 text-blue-800"
                              )}>
                                {risk.severity}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                risk.who_benefits === "User" ? "bg-green-100 text-green-700" :
                                  risk.who_benefits === "Company" ? "bg-red-100 text-red-700" :
                                    "bg-gray-100 text-gray-600"
                              )}>
                                {risk.who_benefits ? `Benefits: ${risk.who_benefits}` : "Neutral"}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  const textToSpeak = plainEnglish ? (risk.simple_explanation || risk.explanation) : risk.explanation;
                                  isSpeaking ? stop() : speak(textToSpeak, selectedLang.code);
                                }}
                              >
                                {isSpeaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 italic font-medium leading-relaxed">
                            “{plainEnglish ? (risk.simple_explanation || risk.explanation) : risk.explanation}”
                          </p>
                          {risk.impact && (
                            <p className="text-[11px] text-red-600 font-semibold bg-red-50 p-2 rounded border border-red-100">
                              <span className="uppercase text-[9px] mr-2">Impact:</span>
                              {risk.impact}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between border-t pt-4">
                  <p className="font-semibold text-lg">Safety Score: {result.score}/100</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 border-primary text-primary hover:bg-primary/5"
                    onClick={() => generateContractReport(displayResult, file?.name || "Contract_Text")}
                  >
                    <FileText className="h-4 w-4" />
                    Download PDF Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
