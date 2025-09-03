import { OpenAIStream, StreamingTextResponse } from 'ai';

// OpenAIクライアントを初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Edge Runtimeで実行することを宣言
export const runtime = 'edge';

export async function POST(req) {
  try {
    const { messages, teacherPrompt } = await req.json();

    // フロントエンドから受け取ったプロンプトを「システムメッセージ」として設定
    const systemMessage = {
      role: 'system',
      content: teacherPrompt || 'You are a helpful teaching assistant.',
    };

    // システムメッセージとユーザーの会話履歴を結合
    const messagesForApi = [systemMessage, ...messages];

    // OpenAI APIを呼び出し
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      stream: true, // ★ これがストリーミングを有効化する重要なオプション
      messages: messagesForApi,
    });

    // 応答をストリームに変換
    const stream = OpenAIStream(response);

    // ストリームをクライアントに返す
    return new StreamingTextResponse(stream);

  } catch (error) {
    // エラーハンドリング
    console.error('Error in chat API:', error);


    return NextResponse.json(
        { error: error.message || 'An unknown error occurred' }, 
        { status: 500 }
    );
  }
}
