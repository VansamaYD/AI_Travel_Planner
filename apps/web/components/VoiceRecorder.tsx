"use client";
import React, { useEffect, useRef, useState } from 'react';

type Props = {
  onResult: (text: string) => void;
};

// 防御性处理：在服务器端模块加载时 window 不存在，使用 typeof window 检查以避免 ReferenceError
const SpeechRecognition = (typeof window !== 'undefined')
  ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  : null;

export default function VoiceRecorder({ onResult }: Props) {
  const recognitionRef = useRef<any | null>(null);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!SpeechRecognition) return;
    const r = new SpeechRecognition();
    r.lang = 'zh-CN';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (event: SpeechRecognitionEvent) => {
      const txt = Array.from(event.results)
        .map(r => r[0].transcript)
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

  if (!SpeechRecognition) {
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
