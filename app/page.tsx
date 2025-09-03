'use client';

import { useState, useRef, useEffect } from 'react';
// データを別ファイルからインポートします
import { worksheets } from './data/worksheets';

// --- アイコンコンポーネント ---
const UserIcon = () => (
  <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" className="h-8 w-8 text-gray-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
);
const BotIcon = () => (
  <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" className="h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM8.5 12.5h7v-1h-7v1zm3.5 3.5h-1v-5h1v5z"/></svg>
);
const ChevronDownIcon = () => (
    <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" className="h-5 w-5 ml-1 transition-transform" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
);


// --- メインページコンポーネント ---
export default function ChatbotPage() {
  // --- State Hooks ---
  const [selectedLesson, setSelectedLesson] = useState(Object.keys(worksheets)[0]);
  const [selectedTopic, setSelectedTopic] = useState(Object.keys(worksheets[selectedLesson])[0]);
  const [selectedProblemId, setSelectedProblemId] = useState(worksheets[selectedLesson][selectedTopic][0].id);
  
  const [studentInput, setStudentInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // --- Derived State ---
  const currentProblem = worksheets[selectedLesson]?.[selectedTopic]?.find(p => p.id === selectedProblemId);

  // --- Effects ---
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    if (currentProblem) {
      setChatHistory([{ role: 'assistant', content: currentProblem.question }]);
    }
  }, [currentProblem]);


  // --- Handlers ---
  const handleProblemSelect = (lesson: string, topic: string, problemId: number) => {
    setSelectedLesson(lesson);
    setSelectedTopic(topic);
    setSelectedProblemId(problemId);
    setIsSelectorOpen(false);
  };

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!studentInput.trim() || isLoading || !currentProblem) return;

    const newUserMessage = { role: 'user', content: studentInput };
    const newChatHistory = [...chatHistory, newUserMessage];

    setChatHistory(newChatHistory);
    setStudentInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newChatHistory,
          teacherPrompt: currentProblem.prompt,
        }),
      });

      // APIからのレスポンスがJSONでない場合も考慮
      if (!response.headers.get("content-type")?.includes("application/json")) {
          const text = await response.text();
          throw new Error(`サーバーから予期しない応答がありました: ${text}`);
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `API error: ${response.statusText}`);
      }
      
      setChatHistory(prev => [...prev, { role: 'assistant', content: result.text }]);
    } catch (error: any) {
      console.error('Failed to fetch chat response:', error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: `エラーが発生しました: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render ---
  return (
    <div className="font-sans bg-gray-100 flex flex-col h-screen max-h-screen">
      {/* ヘッダー */}
      <header className="bg-white p-4 border-b border-gray-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto">
            <h1 className="text-xl font-bold text-gray-800 text-center mb-2">学習支援チャット</h1>
            <div className="text-center">
                <button 
                    onClick={() => setIsSelectorOpen(!isSelectorOpen)} 
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    {currentProblem ? `${selectedLesson} > ${selectedTopic} > ${currentProblem.title}` : "問題を選択"}
                    <ChevronDownIcon />
                </button>
            </div>
        </div>
      </header>

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
            <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && <BotIcon />}
              <div className={`max-w-lg lg:max-w-xl p-3 rounded-2xl ${
                message.role === 'user' 
                  ? 'bg-blue-500 text-white rounded-br-none' 
                  : 'bg-white text-black border border-gray-200 rounded-bl-none'
              }`}>
                <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
              </div>
              {message.role === 'user' && <UserIcon />}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3"><BotIcon /><div className="p-3 rounded-2xl bg-white border border-gray-200"><div className="flex items-center space-x-2"><div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-75"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div></div></div></div>
          )}
          <div ref={chatEndRef} />
        </div>
      </main>

      {/* メッセージ入力フォーム */}
      <footer className="bg-white p-4 border-t border-gray-200 sticky bottom-0 z-10">
        <form onSubmit={handleSendMessage} className="flex items-center gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            className="flex-1 p-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-gray-500"
            value={studentInput}
            onChange={(e) => setStudentInput(e.target.value)}
            placeholder="質問を入力してください..."
            disabled={isLoading || !currentProblem}
          />
          <button type="submit" className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:bg-gray-400" disabled={isLoading || !studentInput.trim() || !currentProblem}>
            <svg xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </button>
        </form>
      </footer>
    </div>
  );
}
