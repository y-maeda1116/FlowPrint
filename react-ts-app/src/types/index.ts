// src/types/index.ts
export interface Task {
  id: string;
  title: string;
  description?: string; // ★ 詳細説明を追加
  completed: boolean;
  parentId: string | null;
  childrenIds: string[]; // children は ID の配列として管理
  createdAt: Date;
  completedAt: Date | null;
  estimatedMinutes?: number;
  tags: string[];
  priority: 'low' | 'medium' | 'high';
}

export interface TaskColumn {
  id: string;
  taskIds: string[]; // tasks は ID の配列として管理
  parentTaskId: string | null;
  level: number;
}
