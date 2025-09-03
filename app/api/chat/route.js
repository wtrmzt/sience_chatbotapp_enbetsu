import OpenAI from 'openai';
import { NextResponse } from 'next/server';

// OpenAIクライアントの初期化
const openai = new OpenAI(); // APIキーは環境変数から自動読み込み

export async function POST(req) {
  // ★デバッグ用: APIルートが呼び出されたことを確認
  console.log("API route /api/chat was hit!");

  try {
    const body = await req.json();
    const { messages, teacherPrompt } = body;

    // ★デバッグ用: 受け取った内容を確認
    console.log("Received prompt:", teacherPrompt);

    if (!messages || !teacherPrompt) {
      console.error("Invalid request: Missing messages or teacherPrompt");
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const apiMessages = [
      { role: 'system', content: teacherPrompt },
      ...messages.map(msg => ({ role: msg.role, content: msg.content })),
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: apiMessages,
    });

    const responseText = completion.choices[0].message.content;

    return NextResponse.json({ text: responseText });

  } catch (error) {
    // ★デバッグ用: エラー内容をログに出力
    console.error('[API Error]', error);
    return NextResponse.json(
        { error: error.message || 'An unknown error occurred' }, 
        { status: 500 }
    );
  }
}
