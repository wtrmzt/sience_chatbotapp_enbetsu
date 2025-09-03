'use client';

import { useChat } from 'ai/react';
import { useState, useRef, useEffect } from 'react';
// データを別ファイルからインポートします
import { worksheets } from './data/worksheets';

// --- アイコンコンポーネント ---
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
);
const BotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM8.5 12.5h7v-1h-7v1zm3.5 3.5h-1v-5h1v5z"/></svg>
);
const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1 transition-transform" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
);

// --- メインページコンポーネント ---
export default function ChatbotPage() {
  // --- State Hooks for problem selection ---
  const [selectedLesson, setSelectedLesson] = useState(Object.keys(worksheets)[0]);
  const [selectedTopic, setSelectedTopic] = useState(Object.keys(worksheets[selectedLesson])[0]);
  const [selectedProblemId, setSelectedProblemId] = useState(worksheets[selectedLesson][selectedTopic][0].id);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // --- Derived State ---
  const currentProblem = worksheets[selectedLesson]?.[selectedTopic]?.find(p => p.id === selectedProblemId);

  // --- Vercel AI SDKのuseChatフックでチャット機能を一元管理 ---
  // 以前のuseState(chatHistory, studentInput, isLoading)は不要になります
  const { messages, input, handleInputChange, handleSubmit, setMessages, isLoading } = useChat({
    // APIに送信するリクエストのbodyに追加情報を加えます
    body: {
      teacherPrompt: currentProblem?.prompt,
    },
    // チャットの初期メッセージを設定します
    initialMessages: currentProblem ? [{ id: 'initial', role: 'assistant', content: currentProblem.question }] : [],
  });

  // --- Effects ---
  // 新しいメッセージが追加されたら、チャットの末尾までスクロールします
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 別の問題が選択されたら、チャット履歴をリセットします
  useEffect(() => {
    if (currentProblem) {
      setMessages([{ id: 'initial', role: 'assistant', content: currentProblem.question }]);
    }
  }, [currentProblem, setMessages]);


  // --- Handlers ---
  const handleProblemSelect = (lesson: string, topic: string, problemId: number) => {
    setSelectedLesson(lesson);
    setSelectedTopic(topic);
    setSelectedProblemId(problemId);
    setIsSelectorOpen(false);
  };
  
  // handleSendMessageはuseChatのhandleSubmitに置き換わるため不要になります

  // --- Render ---
  return (
    <div className="font-sans bg-gray-100 flex flex-col h-screen max-h-screen">
      {/* Header */}
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

      {/* Problem Selector Panel (変更なし) */}
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

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* 表示するメッセージをuseChatから取得した`messages`に変更 */}

          {messages.map((m: { id: string; role: 'user' | 'assistant'; content: string }) => (
            <div key={m.id} className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && <BotIcon />}
              <div className={`max-w-lg lg:max-w-xl p-3 rounded-2xl break-words ${
                m.role === 'user' 
                  ? 'bg-blue-500 text-white rounded-br-none' 
                  : 'bg-white text-black border border-gray-200 rounded-bl-none'
              }`}>
                <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</p>
              </div>
              {m.role === 'user' && <UserIcon />}
            </div>
          ))}
           {/* ローディング中のアニメーションは不要になります */}
           <div ref={chatEndRef} />
        </div>
      </main>

      {/* Input Form */}
      <footer className="bg-white p-4 border-t border-gray-200 sticky bottom-0 z-10">
        {/* 送信処理をuseChatの`handleSubmit`に変更 */}
        <form onSubmit={handleSubmit} className="flex items-center gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            className="flex-1 p-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-gray-500"
            // valueとonChangeもuseChatから取得したものに変更
            value={input}
            onChange={handleInputChange}
            placeholder="質問を入力してください..."
            disabled={isLoading || !currentProblem}
          />
          <button type="submit" className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:bg-gray-400" disabled={isLoading || !input.trim() || !currentProblem}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </button>
        </form>
      </footer>
    </div>
  );
}

