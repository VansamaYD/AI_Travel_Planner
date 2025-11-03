"use client";
import React, { useEffect, useRef, useState } from 'react';

type Props = {
  onResult: (text: string) => void;
};

export default function VoiceRecorder({ onResult }: Props) {
  const recognitionRef = useRef<any | null>(null);
  const finalTextRef = useRef<string>('');
  const userStoppedRef = useRef<boolean>(false); // 标记是否用户主动停止
  const listeningRef = useRef<boolean>(false); // 使用 ref 跟踪 listening 状态，避免闭包问题
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // defer detection until after mount so server and client initial markup match
    if (typeof window === 'undefined') return;
    
    // Chrome 和 Safari 都支持 webkitSpeechRecognition，Chrome 也支持 SpeechRecognition
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
    if (!SR) {
      setSupported(false);
      setError('当前浏览器不支持语音识别。Chrome 需要 HTTPS 连接才能使用。');
      return;
    }
    
    // 检查是否在 HTTPS 或 localhost（Chrome 需要 HTTPS，Safari 在 HTTP 下也可能工作）
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    
    if (!isSecure && isChrome && window.location.protocol === 'http:') {
      setSupported(true); // 标记为支持，但会显示警告
      setError('Chrome 浏览器需要 HTTPS 连接才能使用语音识别。请在 HTTPS 环境下使用，或使用 Safari 浏览器。');
    } else {
      setError(null);
    }
    
    setSupported(true);
    const r = new SR();
    r.lang = 'zh-CN';
    r.interimResults = true; // 启用实时识别结果
    r.continuous = true; // 连续识别模式（关键：让识别持续进行）
    r.maxAlternatives = 1;
    
    r.onresult = (event: any) => {
      // 在连续模式下，只处理新结果（从 resultIndex 开始）
      // 关键：只有最终结果才累积到输入框，临时结果只用于实时显示
      
      let newFinal = '';
      let newInterim = '';
      
      // 只处理新结果（从 resultIndex 开始）
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          // 新的最终结果：累积到最终文本中（只有这个才会真正添加到输入框）
          newFinal += transcript;
        } else {
          // 新的临时结果：只用于实时显示，不累积到输入框
          newInterim += transcript;
        }
      }
      
      // 只有最终结果才追加到累积文本（避免临时结果的重复）
      if (newFinal) {
        // 追加新的最终结果到累积文本
        finalTextRef.current += newFinal;
        // 有新的最终结果时，传递完整的累积文本（只有最终结果，不包含临时结果）
        // 这样确保只有最终确认的内容才会累积到输入框
        setInterimText(finalTextRef.current);
        onResult(finalTextRef.current);
      } else if (newInterim) {
        // 只有临时结果时，只用于实时显示（setInterimText），不传递到输入框（不调用 onResult）
        // 这样可以避免临时结果被累积（临时结果会不断变化："开始" -> "开始形" -> "开始形成"）
        // 临时结果确认后会变成最终结果，那时再通过 onResult 传递
        setInterimText(finalTextRef.current + newInterim);
        // 重要：不调用 onResult，避免临时结果被累积
      } else {
        // 既没有新最终结果，也没有新临时结果，确保显示正确的累积文本
        setInterimText(finalTextRef.current);
      }
    };
    
    r.onerror = (e: any) => {
      console.warn('Speech error', e);
      // 某些错误不应该停止识别（如 no-speech 在连续模式下是正常的）
      if (e.error === 'no-speech') {
        // 在连续模式下，no-speech 不应该停止识别，让它自动重启
        return;
      }
      if (e.error === 'not-allowed') {
        // 检查是否是 Chrome 的 HTTPS 问题
        const isChrome = /Chrome/.test(navigator.userAgent);
        const isHttp = window.location.protocol === 'http:';
        if (isChrome && isHttp) {
          setError('Chrome 浏览器需要 HTTPS 连接才能使用语音识别。请在 HTTPS 环境下使用，或使用 Safari 浏览器。');
        } else {
          setError('语音识别权限被拒绝，请检查浏览器权限设置');
        }
        listeningRef.current = false;
        setListening(false);
        setInterimText('');
      } else if (e.error === 'audio-capture') {
        setError('无法访问麦克风，请检查设备权限');
        listeningRef.current = false;
        setListening(false);
        setInterimText('');
      } else if (e.error === 'network') {
        setError('网络错误，请检查网络连接');
        listeningRef.current = false;
        setListening(false);
        setInterimText('');
      }
    };
    
    r.onend = () => {
      // 如果不是用户主动停止，且还在 listening 状态，自动重启识别
      if (!userStoppedRef.current && listeningRef.current) {
        try {
          // 在重启前，确保累积的文本已更新到输入框
          if (finalTextRef.current) {
            onResult(finalTextRef.current);
          }
          
          // 短暂延迟后重启，避免立即重启导致的错误
          setTimeout(() => {
            if (recognitionRef.current && listeningRef.current && !userStoppedRef.current) {
              try {
                // 重启时不清空 finalTextRef.current，保留累积的文本
                recognitionRef.current.start();
              } catch (e: any) {
                // 如果重启失败（可能是已经停止），清除状态
                if (e?.message?.includes('not started') || e?.name === 'InvalidStateError') {
                  listeningRef.current = false;
                  setListening(false);
                } else {
                  console.warn('Auto restart error', e);
                }
              }
            }
          }, 200);
        } catch (e) {
          console.warn('Restart error', e);
        }
        return; // 不执行停止逻辑
      }
      
      // 用户主动停止，执行停止逻辑
      listeningRef.current = false;
      setListening(false);
      userStoppedRef.current = false; // 重置标记
      
      // 如果还有未发送的文本，发送它（最终保存）
      if (finalTextRef.current) {
        onResult(finalTextRef.current);
        // 注意：不清空 finalTextRef.current，这样如果用户重新开始录音，可以继续累积
      }
      setInterimText('');
    };
    
    recognitionRef.current = r;
    return () => {
      try { r.stop(); } catch (e) {}
      recognitionRef.current = null;
      finalTextRef.current = '';
    };
  }, [onResult]);

  const start = () => {
    if (!recognitionRef.current) return;
    try {
      finalTextRef.current = '';
      setInterimText('');
      userStoppedRef.current = false; // 重置用户停止标记
      setError(null); // 清除错误（可能在运行时重新设置）
      recognitionRef.current.start();
      listeningRef.current = true;
      setListening(true);
    } catch (e: any) {
      console.warn('start error', e);
      listeningRef.current = false;
      setListening(false);
      if (e?.message?.includes('already started') || e?.name === 'InvalidStateError') {
        // 如果已经在运行，忽略错误，但确保状态正确
        listeningRef.current = true;
        setListening(true);
      } else {
        const errorMsg = String(e?.message || e);
        // 检查是否是 Chrome 的 HTTPS 错误
        if (errorMsg.includes('not allowed') || errorMsg.includes('not-allowed') || 
            (window.location.protocol === 'http:' && /Chrome/.test(navigator.userAgent))) {
          setError('Chrome 浏览器需要 HTTPS 连接才能使用语音识别。请在 HTTPS 环境下使用，或使用 Safari 浏览器。');
        } else {
          setError('启动语音识别失败：' + errorMsg);
        }
      }
    }
  };

  const stop = () => {
    if (!recognitionRef.current) return;
    try {
      userStoppedRef.current = true; // 标记为用户主动停止
      listeningRef.current = false; // 立即更新 ref
      recognitionRef.current.stop();
      setListening(false); // 立即更新 UI
    } catch (e: any) {
      console.warn('stop error', e);
      // 即使 stop 出错，也标记为用户停止
      userStoppedRef.current = true;
      listeningRef.current = false;
      setListening(false);
    }
  };

  // Render a consistent initial placeholder so SSR and first client render match.
  if (!supported) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 13, color: '#9ca3af' }}>当前浏览器不支持语音识别</div>
        {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button 
        onClick={listening ? stop : start} 
        disabled={!!error}
        style={{ 
          padding: '8px 16px', 
          fontSize: 14,
          background: listening ? '#ef4444' : (error ? '#9ca3af' : '#10b981'), 
          color: '#fff', 
          border: 'none', 
          borderRadius: 6, 
          cursor: error ? 'not-allowed' : 'pointer',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          opacity: error ? 0.6 : 1
        }}
      >
        {listening ? '⏹ 停止录音' : '🎤 开始录音'}
      </button>
      {error && (
        <div style={{ fontSize: 12, color: '#ef4444', padding: '6px 8px', background: '#fef2f2', borderRadius: 4, maxWidth: 300 }}>
          {error}
        </div>
      )}
      {listening && interimText && (
        <div style={{ fontSize: 12, color: '#6b7280', padding: '6px 8px', background: '#f3f4f6', borderRadius: 4, maxWidth: 300 }}>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>正在识别：</div>
          <div>{interimText}</div>
        </div>
      )}
    </div>
  );
}
