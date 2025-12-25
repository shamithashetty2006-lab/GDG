"use client";

import { useState, useCallback, useEffect } from "react";

export function useSpeech() {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [supported, setSupported] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
            setSupported(true);
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

        const utterance = new SpeechSynthesisUtterance(text);

        // Try to find a voice for the target language
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.startsWith(lang.split("-")[0]));
        if (voice) {
            utterance.voice = voice;
        }
        utterance.lang = lang;

        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        utterance.onstart = () => setIsSpeaking(true);

        window.speechSynthesis.speak(utterance);
    }, [stop]);

    return { speak, stop, isSpeaking, supported };
}
