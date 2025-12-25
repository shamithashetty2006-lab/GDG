"use client";

import { useState, useEffect, useCallback } from "react";

export function useSTT() {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [supported, setSupported] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                setSupported(true);
            }
        }
    }, []);

    const startListening = useCallback(() => {
        setError(null);
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError("Speech recognition is not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US"; // Specifically targeting English as per requirement

        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event: any) => {
            const current = event.resultIndex;
            const transcriptValue = event.results[current][0].transcript;
            setTranscript(transcriptValue);
        };

        recognition.onerror = (event: any) => {
            console.error("STT Error:", event.error);
            setError(event.error === 'no-speech' ? "No speech detected. Please try again." : `Error: ${event.error}`);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.start();
    }, []);

    return { isListening, transcript, error, supported, startListening, setTranscript };
}
