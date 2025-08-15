'use client';

import { useState, useRef, useEffect } from 'react';

// --- データ定義 ---
// 授業と問題、それに対応するプロンプトをここで定義します。

type Problem = {
  id: number;
  title: string;
  question: string;
  prompt: string;
};

type Worksheets = {
  [lesson: string]: {
    [topic: string]: Problem[];
  };
};

const worksheets: Worksheets = {
  "生物基礎": {
    "6. 光合成": [
      {
        id: 1,
        title: "問1: 呼吸と光合成の場所",
        question: "ワークシートの問1について、分からないことを質問してください。\n\n**問題:** 呼吸と光合成を行う細胞の組織はそれぞれ何か答えなさい。",
        prompt: "あなたは生物の先生です。生徒が「呼吸と光合成の場所」について質問しています。呼吸は「すべての細胞」が、光合成は「葉緑体を持つ細胞」が行うという点を核心的なヒントとし、生徒が自分で答えを導き出せるように誘導してください。例えば、「動物も呼吸するかな？」「植物の根っこは光合成できるかな？」といった問いかけが有効です。直接的な答えは絶対に教えないでください。"
      },
      {
        id: 2,
        title: "問2: 光合成の反応式",
        question: "ワークシートの問2について、分からないことを質問してください。\n\n**問題:** 光合成の反応式を答えなさい。",
        prompt: "あなたは生物の先生です。生徒が「光合成の反応式」について質問しています。「材料は何か？（二酸化炭素と水）」「何が作られるか？（デンプンなどの有機物と酸素）」「何が必要か？（光エネルギー）」という3つのポイントをヒントに、生徒が化学式を組み立てられるように手助けしてください。直接的な答えは教えないでください。"
      },
      {
        id: 3,
        title: "問3: CO2濃度と光合成",
        question: "ワークシートの問3について、分からないことを質問してください。\n\n**問題:** グラフを参考に、CO2濃度と作物の収穫量の関係を考察しなさい。",
        prompt: "あなたは生物の先生です。生徒が「CO2濃度と光合成」の関係について質問しています。CO2は光合成の「材料」であることを思い出させ、「材料が増えれば、作られるもの（生産物）も増える」という基本的な考え方に誘導してください。ただし、「他の要因（光の強さや温度など）が十分であれば」という条件も重要であることを伝え、多角的な視点を促してください。"
      }
    ]
  },
  "化学基礎": {
    "1. 物質の探求": [
        {
            id: 1,
            title: "問1: 純物質と混合物",
            question: "純物質と混合物の違いについて、分からないことを質問してください。",
            prompt: "あなたは化学の先生です。生徒が「純物質と混合物」について質問しています。「1種類の物質だけでできているか、複数の物質が混ざっているか」が基本的な違いであることを教え、「海水」や「純水」を例に出して考えさせてください。生徒が具体的な物質名を挙げたら、それがどちらに分類されるか一緒に考えるように促してください。"
        }
    ]
  }
};

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
  // --- State Hooks ---
  const [selectedLesson, setSelectedLesson] = useState(Object.keys(worksheets)[0]);
  const [selectedTopic, setSelectedTopic] = useState(Object.keys(worksheets[selectedLesson])[0]);
  const [selectedProblemId, setSelectedProblemId] = useState(worksheets[selectedLesson][selectedTopic][0].id);
  
  const [studentInput, setStudentInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false); // 問題選択UIの開閉状態
  
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // --- Derived State ---
  const currentProblem = worksheets[selectedLesson]?.[selectedTopic]?.find(p => p.id === selectedProblemId);

  // --- Effects ---
  // チャット履歴が更新されるたびに、一番下までスクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // 問題が変更されたときにチャットを初期化
  useEffect(() => {
    if (currentProblem) {
      setChatHistory([{ role: 'assistant', content: currentProblem.question }]);
    }
  }, [currentProblem]);


  // --- Handlers ---
  interface HandleProblemSelect {
    (lesson: string, topic: string, problemId: number): void;
  }

  const handleProblemSelect: HandleProblemSelect = (lesson, topic, problemId) => {
    setSelectedLesson(lesson);
    setSelectedTopic(topic);
    setSelectedProblemId(problemId);
    setIsSelectorOpen(false); // 選択したら閉じる
  };

  interface ChatMessage {
    role: string;
    content: string;
  }

  interface ChatApiRequest {
    messages: ChatMessage[];
    teacherPrompt: string;
  }

  interface ChatApiResponse {
    text: string;
    error?: string;
  }

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!studentInput.trim() || isLoading || !currentProblem) return;

    const newUserMessage: ChatMessage = { role: 'user', content: studentInput };
    const newChatHistory: ChatMessage[] = [...chatHistory, newUserMessage];

    setChatHistory(newChatHistory);
    setStudentInput('');
    setIsLoading(true);

    try {
      const response: Response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newChatHistory,
          teacherPrompt: currentProblem.prompt,
        } as ChatApiRequest),
      });

      if (!response.ok) {
        const errorData: ChatApiResponse = await response.json();
        throw new Error(errorData.error || `API error: ${response.statusText}`);
      }
      
      const result: ChatApiResponse = await response.json();
      setChatHistory((prev: ChatMessage[]) => [...prev, { role: 'assistant', content: result.text }]);
    } catch (error: any) {
      console.error('Failed to fetch chat response:', error);
      setChatHistory((prev: ChatMessage[]) => [...prev, { role: 'assistant', content: `エラーが発生しました: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render ---
  return (
    <div className="font-sans bg-gray-100 flex flex-col h-screen max-h-screen">
      {/* --- ヘッダー: 問題選択 --- */}
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

      {/* --- 問題選択パネル --- */}
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

      {/* --- チャット画面 --- */}
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

      {/* --- メッセージ入力フォーム --- */}
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
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </button>
        </form>
      </footer>
    </div>
  );
}

