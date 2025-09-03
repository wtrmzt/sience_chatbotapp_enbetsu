import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { NextRequest } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ▼【重要点3】Edge RuntimeでAPIを実行することを宣言
export const runtime = 'edge';

export async function POST(req) {
  try {
    const { messages, teacherPrompt } = await req.json();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      // ▼【重要点4】OpenAIに応答をストリーミング形式で要求
      stream: true, 
      messages: [
        { role: 'system', content: teacherPrompt },
        ...messages
      ],
    });

    // ▼【重要点5】応答をクライアント向けのストリームに変換
    const stream = OpenAIStream(response);

    // ストリーム形式でクライアントに応答を返す
    return new StreamingTextResponse(stream);

  } catch (error) {
    // ★デバッグ用: エラー内容をログに出力
    console.error('[API Error]', error);
    return NextResponse.json(
        { error: error.message || 'An unknown error occurred' }, 
        { status: 500 }
    );
  }
}
