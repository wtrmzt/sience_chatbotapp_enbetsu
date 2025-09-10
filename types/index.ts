// 科目 (大区分)
export type Lesson = {
  id: string; // FirestoreのドキュメントID
  name: string; // 科目名 (例: 生物基礎)
  topics: Topic[]; // この科目に含まれる授業のリスト
};

// 授業 (中区分)
export type Topic = {
  id: string; // FirestoreのドキュメントID
  name: string; // 授業名 (例: 生物基礎_20 脳のはたらき)
  problems: Problem[]; // この授業に含まれる設問のリスト
};

// 設問 (小区分)
export type Problem = {
  id: string; // FirestoreのドキュメントID
  title: string; // 設問名 (例: 問2: 植物状態を〜)
  question: string; // 生徒への「最初の問いかけ」
  prompt: string; // AIへの指示プロンプト
  published: boolean; // ★追加: 生徒に公開されているか
};

