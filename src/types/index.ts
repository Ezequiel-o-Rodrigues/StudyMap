export interface AssessmentQuestion {
  id: string;
  node_id: string;
  content_source_url: string;
  difficulty: 'beginner' | 'intermediate' | 'expert';
  question: string;
  options: string[];
  correct_answer: number; // Index of the correct option
  explanation: string;
}

export interface AssessmentResult {
  id: string;
  user_id: string;
  node_id: string;
  score: number;
  passed: boolean;
  chat_history: any[];
  created_at: string;
}

export enum NodeStatus {
  Locked = 'locked',
  Current = 'current',
  Completed = 'completed',
}

export enum UserRole {
  Student = 'student',
  Admin = 'admin',
}

export interface StudyLink {
  type: 'course' | 'youtube' | 'reference';
  title: string;
  url: string;
  credentials?: string;
}

export interface StudyNode {
  id: string;
  title: string;
  description: string;
  status: NodeStatus;
  links: StudyLink[];
  order_index: number;
}

export interface LearningReport {
  id: string;
  user_id: string;
  node_id: string;
  content: string;
  teacher_feedback?: string;
  status: 'pending' | 'approved' | 'rejected';
  attachments?: string[]; // URLs of attached files
  created_at: string;
}
