'use client';

import { useState, useRef, useEffect } from 'react';

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

const TeacherIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-gray-700" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 8.48L4.74 8 12 4.52 19.26 8 12 11.48zM17 18h-1.5v-2H17v2zm-3.5 0H12v-2h1.5v2zm-3.5 0H8.5v-2H10v2z" />
    </svg>
);

// --- メインページコンポーネント ---
export default function ChatbotPage() {
  // --- State Hooks ---
  const [teacherPrompt, setTeacherPrompt] = useState('あなたは優秀なアシスタントです。学生が質問をしてきますが、直接的な答えは教えず、学生が自力で答えにたどり着けるようなヒントや考え方を提示してください。');
  const [savedPrompt, setSavedPrompt] = useState(teacherPrompt);
  const [studentInput, setStudentInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  const chatEndRef = useRef(null);

  // --- Effects ---
  // チャット履歴が更新されるたびに、一番下までスクロールする
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // --- Handlers ---
  /**
   * 教員のプロンプトを保存するハンドラ
   */
  const handleSavePrompt = () => {
    setSavedPrompt(teacherPrompt);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  /**
   * 学生がメッセージを送信したときのハンドラ
   * @param {React.FormEvent<HTMLFormElement>} e - フォームイベント
   */
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!studentInput.trim() || isLoading) return;

    const newUserMessage = { role: 'user', content: studentInput };
    const newChatHistory = [...chatHistory, newUserMessage];

    setChatHistory(newChatHistory);
    setStudentInput('');
    setIsLoading(true);

    try {
      // バックエンドAPIにリクエストを送信
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newChatHistory,
          teacherPrompt: savedPrompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // APIからの応答をチャット履歴に追加
      setChatHistory(prev => [...prev, { role: 'assistant', content: result.text }]);

    } catch (error) {
      console.error('Failed to fetch chat response:', error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: `エラーが発生しました: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render ---
  return (
    <div className="font-sans bg-gray-50 flex flex-col lg:flex-row h-screen">
      {/* --- 教員用設定パネル --- */}
      <div className="lg:w-1/3 bg-white p-6 border-r border-gray-200 shadow-lg m-4 rounded-xl">
        <div className="flex items-center text-2xl font-bold text-gray-800 mb-6">
            <TeacherIcon />
            教員用設定パネル
        </div>
        <div className="space-y-4">
          <label htmlFor="teacher-prompt" className="block text-sm font-medium text-gray-700">
            AIへの指示プロンプト
          </label>
          <p className="text-xs text-gray-500">
            ここに設定した内容に基づき、AIが学生へのヒントを生成します。
          </p>
          <textarea
            id="teacher-prompt"
            rows="10"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            value={teacherPrompt}
            onChange={(e) => setTeacherPrompt(e.target.value)}
            placeholder="例: あなたは優秀なアシスタントです..."
          />
          <button
            onClick={handleSavePrompt}
            className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform transform hover:scale-105"
          >
            この指示をチャットボットに設定する
          </button>
          {showNotification && (
            <div className="mt-2 text-center text-sm text-green-600 bg-green-100 p-2 rounded-lg">
              プロンプトを設定しました！
            </div>
          )}
        </div>
        <div className="mt-8 p-4 bg-gray-100 rounded-lg text-sm text-gray-600">
            <h4 className="font-bold mb-2">使い方ガイド</h4>
            <ol className="list-decimal list-inside space-y-1">
                <li>AIへの指示プロンプトを入力します。</li>
                <li>「設定する」ボタンを押してAIに役割を与えます。</li>
                <li>学生画面でAIとの対話を開始できます。</li>
            </ol>
        </div>
      </div>

      {/* --- 学生用チャットパネル --- */}
      <div className="flex-1 flex flex-col bg-gray-100 m-4 rounded-xl shadow-inner">
        <div className="p-4 border-b border-gray-200 bg-white rounded-t-xl">
          <h2 className="text-xl font-bold text-center text-gray-800">学習支援チャット</h2>
        </div>

        {/* チャット履歴 */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            {chatHistory.map((message, index) => (
              <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                {message.role === 'assistant' && <BotIcon />}
                <div className={`max-w-lg p-3 rounded-2xl ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white rounded-br-none' 
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                }`}>
                  <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
                </div>
                 {message.role === 'user' && <UserIcon />}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-3">
                <BotIcon />
                <div className="max-w-lg p-3 rounded-2xl bg-white text-gray-800 border border-gray-200 rounded-bl-none">
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
        </div>

        {/* メッセージ入力フォーム */}
        <div className="p-4 bg-white border-t border-gray-200 rounded-b-xl">
          <form onSubmit={handleSendMessage} className="flex items-center gap-3">
            <input
              type="text"
              className="flex-1 p-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={studentInput}
              onChange={(e) => setStudentInput(e.target.value)}
              placeholder="質問を入力してください..."
              disabled={isLoading}
            />
            <button
              type="submit"
              className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              disabled={isLoading || !studentInput.trim()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}