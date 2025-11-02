"use client";
import React, { useEffect, useRef, useState } from 'react';

type Props = {
  onResult: (text: string) => void;
};

export default function VoiceRecorder({ onResult }: Props) {
  const recognitionRef = useRef<any | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // defer detection until after mount so server and client initial markup match
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
    if (!SR) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const r = new SR();
    r.lang = 'zh-CN';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (event: any) => {
      const txt = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      onResult(txt);
    };
    r.onerror = (e: any) => {
      console.warn('Speech error', e);
    };
    recognitionRef.current = r;
    return () => {
      try { r.stop(); } catch (e) {}
      recognitionRef.current = null;
    };
  }, [onResult]);

  const start = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setListening(true);
      recognitionRef.current.onend = () => setListening(false);
    } catch (e) {
      console.warn('start error', e);
    }
  };

  const stop = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setListening(false);
  };

  // Render a consistent initial placeholder so SSR and first client render match.
  if (!supported) {
    return <div>当前浏览器不支持 Web Speech API（语音识别）</div>;
  }

  return (
    <div>
      <button onClick={listening ? stop : start} style={{ padding: '8px 12px' }}>
        {listening ? '停止录音' : '开始录音'}
      </button>
    </div>
  );
}
