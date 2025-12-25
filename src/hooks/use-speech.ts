"use client";

import { useState, useCallback, useEffect } from "react";

export function useSpeech() {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [supported, setSupported] = useState(false);

    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
            setSupported(true);

            const updateVoices = () => {
                setVoices(window.speechSynthesis.getVoices());
            };

            updateVoices();
            window.speechSynthesis.onvoiceschanged = updateVoices;

            return () => {
                window.speechSynthesis.onvoiceschanged = null;
            };
        }
    }, []);

    const stop = useCallback(() => {
        if (typeof window !== "undefined") {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    }, []);

    const speak = useCallback((text: string, lang: string = "en-US") => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

        stop();

        // Basic character cleanup for better synthesis
        const cleanText = text.replace(/[*_#]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);

        // Priority 1: Exact match (e.g., 'mr-IN')
        // Priority 2: Language family match (e.g., 'mr')
        // Priority 3: Any voice that starts with the language prefix
        const availableVoices = window.speechSynthesis.getVoices();
        const voice = availableVoices.find(v => v.lang === lang) ||
            availableVoices.find(v => v.lang.startsWith(lang.split("-")[0])) ||
            availableVoices.find(v => v.name.toLowerCase().includes(lang.split("-")[0].toLowerCase()));

        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang; // Use the matched voice's language
        } else {
            utterance.lang = lang; // Fallback to provided lang code
            console.warn(`No native voice found for ${lang}. Falling back to default.`);
        }

        utterance.rate = 0.9; // Slightly slower for better clarity in regional languages
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (e) => {
            console.error("Speech error:", e);
            setIsSpeaking(false);
        };
        utterance.onstart = () => setIsSpeaking(true);

        window.speechSynthesis.speak(utterance);
    }, [stop]);

    return { speak, stop, isSpeaking, supported };
}
