"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, HelpCircle } from "lucide-react";
import { Button } from "./ui/button";

const STEPS = [
    {
        title: "Welcome to ClearSign!",
        content: "Let's take a quick tour to help you understand how to use the platform to analyze and manage your contracts effectively.",
        image: "https://img.freepik.com/free-vector/user-onboarding-concept-illustration_114360-10657.jpg"
    },
    {
        title: "Upload & Analyze",
        content: "You can upload PDF, DOCX, or images of contracts, or simply paste the text directly. Our AI will identify key risks and clauses for you.",
        target: "upload-section"
    },
    {
        title: "Understand Results",
        content: "View summaries, key details, and risk levels. Use the 'Simple' toggle to translate legal jargon into plain English.",
        target: "results-section"
    },
    {
        title: "Regional Languages & TTS",
        content: "Translate your analysis into 7+ regional languages and listen to them using our built-in Text-to-Speech feature.",
        target: "language-section"
    },
    {
        title: "Dashboard History",
        content: "When signed in, all your analyses are automatically saved to your dashboard for future reference.",
        target: "dashboard-link"
    }
];

export function OnboardingTour() {
    const [isOpen, setIsOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        const hasCompletedTour = localStorage.getItem("clearSign-tour-completed");
        if (!hasCompletedTour) {
            setIsOpen(true);
        }
    }, []);

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleComplete();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleComplete = () => {
        setIsOpen(false);
        localStorage.setItem("clearSign-tour-completed", "true");
    };

    const handleSkip = () => {
        setIsOpen(false);
        localStorage.setItem("clearSign-tour-completed", "true");
    };

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={() => { setIsOpen(true); setCurrentStep(0); }}
                className="fixed bottom-4 right-4 z-40 rounded-full shadow-lg border-primary/20 bg-white/80 backdrop-blur-sm"
            >
                <HelpCircle className="h-4 w-4 mr-2 text-primary" />
                Help Guide
            </Button>

            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border"
                        >
                            <div className="relative h-48 bg-gray-50 flex items-center justify-center overflow-hidden border-b">
                                {STEPS[currentStep].image ? (
                                    <img
                                        src={STEPS[currentStep].image}
                                        alt="illustration"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-primary/40">
                                        <HelpCircle className="h-16 w-16 mb-2" />
                                        <span className="text-sm font-bold uppercase tracking-widest text-gray-300">Step {currentStep + 1}</span>
                                    </div>
                                )}
                                <button
                                    onClick={handleSkip}
                                    className="absolute top-4 right-4 p-1.5 rounded-full bg-white/80 text-gray-400 hover:text-gray-900 transition-colors border"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-8">
                                <div className="flex gap-1.5 mb-6">
                                    {STEPS.map((_, i) => (
                                        <div
                                            key={i}
                                            className={`h-1 rounded-full transition-all duration-300 ${i === currentStep ? "w-8 bg-primary" : "w-2 bg-gray-200"}`}
                                        />
                                    ))}
                                </div>

                                <h3 className="text-2xl font-bold text-gray-900 mb-3">{STEPS[currentStep].title}</h3>
                                <p className="text-gray-600 leading-relaxed min-h-[80px]">
                                    {STEPS[currentStep].content}
                                </p>

                                <div className="flex items-center justify-between mt-8 pt-6 border-t font-medium">
                                    <button
                                        onClick={handleSkip}
                                        className="text-gray-400 hover:text-gray-600 px-2"
                                    >
                                        Skip
                                    </button>

                                    <div className="flex gap-3">
                                        {currentStep > 0 && (
                                            <Button
                                                variant="ghost"
                                                onClick={handleBack}
                                                className="gap-2"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                                Back
                                            </Button>
                                        )}
                                        <Button
                                            onClick={handleNext}
                                            className="min-w-[120px] rounded-xl font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                                        >
                                            {currentStep === STEPS.length - 1 ? "Get Started" : "Continue"}
                                            {currentStep !== STEPS.length - 1 && <ChevronRight className="h-4 w-4 ml-2" />}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
