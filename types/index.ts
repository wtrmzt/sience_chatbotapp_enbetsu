// Single problem structure
export type Problem = {
  id: string; // Use string for Firestore document ID
  title: string;
  question: string;
  prompt: string;
};

// Structure for a topic containing multiple problems
export type Topic = {
  id: string; // Use string for Firestore document ID
  name: string;
  problems: Problem[];
};

// Structure for a lesson containing multiple topics
export type Lesson = {
  id:string; // Use string for Firestore document ID
  name: string;
  topics: Topic[];
};
