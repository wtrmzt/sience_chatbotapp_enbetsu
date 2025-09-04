'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
// データを別ファイルからインポートします
import { worksheets } from './data/worksheets';

// --- アイコンコンポーネント ---
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM8.5 12.5h7v-1h-7v1zm3.5 3.5h-1v-5h1v5z"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

// --- レート制限フック ---
const useRateLimit = (limit = 10, windowMs = 60000) => {
  const [requests, setRequests] = useState<number[]>([]);
  
  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    const windowStart = now - windowMs;
    const validRequests = requests.filter(time => time > windowStart);
    
    if (validRequests.length >= limit) {
      return false;
    }
    
    setRequests([...validRequests, now]);
    return true;
  }, [requests, limit, windowMs]);
  
  const getRemainingRequests = useCallback(() => {
    const now = Date.now();
    const windowStart = now - windowMs;
    const validRequests = requests.filter(time => time > windowStart);
    return Math.max(0, limit - validRequests.length);
  }, [requests, limit, windowMs]);
  
  return { checkRateLimit, getRemainingRequests };
};

// --- デバウンスフック ---
const useDebounce = (callback: Function, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

// --- メインページコンポーネント ---
export default function ChatbotPage() {
  // --- State Hooks ---
  const [selectedLesson, setSelectedLesson] = useState(Object.keys(worksheets)[0]);
  const [selectedTopic, setSelectedTopic] = useState(Object.keys(worksheets[selectedLesson])[0]);
  const [selectedProblemId, setSelectedProblemId] = useState(worksheets[selectedLesson][selectedTopic][0].id);
  
  const [studentInput, setStudentInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string; timestamp?: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // --- カスタムフック ---
  const { checkRateLimit, getRemainingRequests } = useRateLimit(10, 60000);
  
  // --- Derived State (useMemo で最適化) ---
  const currentProblem = useMemo(() => {
    return worksheets[selectedLesson]?.[selectedTopic]?.find(p => p.id === selectedProblemId);
  }, [selectedLesson, selectedTopic, selectedProblemId]);

  // --- Effects ---
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    if (currentProblem) {
      setChatHistory([{ 
        role: 'assistant', 
        content: currentProblem.question,
        timestamp: Date.now()
      }]);
      setError(null);
    }
  }, [currentProblem]);

  // チャット履歴を最大50件に制限（メモリ使用量削減）
  useEffect(() => {
    if (chatHistory.length > 50) {
      setChatHistory(prev => prev.slice(-50));
    }
  }, [chatHistory]);

  // --- Handlers ---
  const handleProblemSelect = useCallback((lesson: string, topic: string, problemId: number) => {
    setSelectedLesson(lesson);
    setSelectedTopic(topic);
    setSelectedProblemId(problemId);
    setIsSelectorOpen(false);
    setError(null);
  }, []);

  const debouncedInputChange = useDebounce((value: string) => {
    if (value.length > 4000) {
      setError('入力は4000文字以内にしてください。');
    } else {
      setError(null);
    }
  }, 300);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStudentInput(value);
    debouncedInputChange(value);
  }, [debouncedInputChange]);

  const handleSendMessage = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!studentInput.trim() || isLoading || !currentProblem || error) return;

    if (!checkRateLimit()) {
      setError(`レート制限に達しました。残り ${getRemainingRequests()} 回のリクエストが可能です。`);
      return;
    }

    const newUserMessage = { 
      role: 'user', 
      content: studentInput.trim().slice(0, 4000),
      timestamp: Date.now()
    };
    const newChatHistory = [...chatHistory, newUserMessage];

    setChatHistory(newChatHistory);
    setStudentInput('');
    setIsLoading(true);
    setError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newChatHistory.slice(-10),
          teacherPrompt: currentProblem.prompt,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        let errorMessage = 'エラーが発生しました。';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          if (response.status === 429) errorMessage = 'リクエストが多すぎます。しばらくお待ちください。';
          else if (response.status >= 500) errorMessage = 'サーバーエラーが発生しました。';
        }
        throw new Error(errorMessage);
      }

      // ▼▼▼ 修正点: OpenAIからのJSONストリームを正しく処理するロジックに戻します ▼▼▼
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('レスポンスの読み込みに失敗しました。');
      }

      const decoder = new TextDecoder();
      let assistantMessage = '';
      
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: '', 
        timestamp: Date.now() 
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data.trim() === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                assistantMessage += content;
                setChatHistory(prev => {
                  const updated = [...prev];
                  const lastMessage = updated[updated.length - 1];
                  if (lastMessage && lastMessage.role === 'assistant') {
                    lastMessage.content = assistantMessage;
                  }
                  return updated;
                });
              }
            } catch (e) {
              // JSONパースエラーは無視します
            }
          }
        }
      }
      // ▲▲▲ 修正ここまで ▲▲▲

    } catch (error: any) {
      console.error('Failed to fetch chat response:', error);
      
      if (error.name === 'AbortError') {
        return; // ユーザーによるキャンセル
      }
      
      const errorMessage = error.message || 'エラーが発生しました。';
      setError(errorMessage);
      
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: `エラー: ${errorMessage}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [studentInput, isLoading, currentProblem, error, chatHistory, checkRateLimit, getRemainingRequests]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // --- Render ---
  return (
    <div className="font-sans bg-gray-100 flex flex-col h-screen max-h-screen">
      {/* ヘッダー */}
      <header className="bg-white p-4 border-b border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-gray-800 text-center mb-2">学習支援チャット</h1>
          <div className="text-center mb-2">
            <button 
              onClick={() => setIsSelectorOpen(!isSelectorOpen)} 
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {currentProblem ? `${selectedLesson} > ${selectedTopic} > ${currentProblem.title}` : "問題を選択"}
              <ChevronDownIcon />
            </button>
          </div>
          {/* レート制限表示 */}
          <div className="text-center text-xs text-gray-500">
            残りリクエスト: {getRemainingRequests()}/10 (1分間)
          </div>
        </div>
      </header>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mx-4 mt-2 rounded relative">
          <span className="block sm:inline">{error}</span>
          <button 
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setError(null)}
          >
            <span className="sr-only">閉じる</span>
            ×
          </button>
        </div>
      )}

      {/* 問題選択パネル */}
      {isSelectorOpen && (
        <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 z-30" onClick={() => setIsSelectorOpen(false)}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl w-11/12 max-w-md p-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 text-black">問題を選択してください</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {Object.entries(worksheets).map(([lesson, topics]) => (
                <div key={lesson}>
                  <h3 className="font-bold text-black bg-gray-100 p-2 rounded">{lesson}</h3>
                  <div className="pl-2">
                    {Object.entries(topics).map(([topic, problems]) => (
                      <div key={topic} className="mt-1">
                        <h4 className="font-semibold text-gray-800 p-1">{topic}</h4>
                        <div className="pl-2 border-l-2 border-gray-200">
                          {problems.map(problem => (
                            <button 
                              key={problem.id}
                              onClick={() => handleProblemSelect(lesson, topic, problem.id)}
                              className={`w-full text-left p-2 rounded hover:bg-gray-100 ${problem.id === selectedProblemId ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-900'}`}
                            >
                              {problem.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* チャット画面 */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="space-y-6 max-w-4xl mx-auto">
          {chatHistory.map((message, index) => (
            <div key={`${index}-${message.timestamp}`} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && <BotIcon />}
              <div className={`max-w-lg lg:max-w-xl p-3 rounded-2xl ${
                message.role === 'user' 
                  ? 'bg-blue-500 text-white rounded-br-none' 
                  : 'bg-white text-black border border-gray-200 rounded-bl-none'
              }`}>
                <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
                {message.timestamp && (
                  <div className="text-xs opacity-70 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                )}
              </div>
              {message.role === 'user' && <UserIcon />}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3">
              <BotIcon />
              <div className="p-3 rounded-2xl bg-white border border-gray-200">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-75"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </main>

      {/* メッセージ入力フォーム */}
      <footer className="bg-white p-4 border-t border-gray-200 sticky bottom-0 z-10">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            className={`flex-1 p-3 border rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-gray-500 ${
              error ? 'border-red-300' : 'border-gray-300'
            }`}
            value={studentInput}
            onChange={handleInputChange}
            placeholder="質問を入力してください... (最大4000文字)"
            disabled={isLoading || !currentProblem}
            maxLength={4000}
          />
          <button 
            type="submit" 
            className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:bg-gray-400" 
            disabled={isLoading || !studentInput.trim() || !currentProblem || !!error}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
        <div className="text-xs text-gray-500 text-center mt-2">
          {studentInput.length}/4000文字
        </div>
      </footer>
    </div>
  );
}

