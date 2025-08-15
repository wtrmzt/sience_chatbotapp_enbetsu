import OpenAI from 'openai';
import { NextResponse } from 'next/server';

// OpenAIクライアントの初期化
// APIキーは自動的に環境変数 `OPENAI_API_KEY` から読み込まれます。
const openai = new OpenAI();

export async function POST(req) {
  try {
    const body = await req.json();
    const { messages, teacherPrompt } = body;

    if (!messages || !teacherPrompt) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // OpenAI APIに渡すメッセージ配列を構築
    // 1. システムメッセージ（教員の指示）
    // 2. これまでの会話履歴
    const apiMessages = [
      {
        role: 'system',
        content: teacherPrompt,
      },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    ];

    // OpenAI Chat Completions APIを呼び出す
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // または 'gpt-4' など
      messages: apiMessages,
    });

    const responseText = completion.choices[0].message.content;

    return NextResponse.json({ text: responseText });

  } catch (error) {
    console.error('OpenAI API Error:', error);
    // エラーレスポンスをクライアントに返す
    return NextResponse.json(
        { error: error.message || 'An unknown error occurred' }, 
        { status: 500 }
    );
  }
}