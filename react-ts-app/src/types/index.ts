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
  priority: TaskPriority;
}

export interface TaskColumn {
  id: string;
  taskIds: string[]; // tasks は ID の配列として管理
  parentTaskId: string | null;
  level: number;
}

export interface ExportedTask extends Omit<Task, 'createdAt' | 'completedAt'> {
  createdAt: string; // ISO string
  completedAt: string | null; // ISO string or null
}
export interface ExportedData {
  tasks: Record<string, ExportedTask>;
  rootTaskIds: string[];
  taskTemplates: Record<string, TaskTemplate>; // Use 'any' for now, or define ExportedTaskTemplate if dates exist
  version: number; // データフォーマットのバージョン
}
export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskTemplateTaskDefinition {
  title: string;
  description?: string;
  estimatedMinutes?: number;
  priority?: TaskPriority;
  tags?: string[];
  children?: TaskTemplateTaskDefinition[];
}

export interface TaskTemplate {
  id: string;
  name: string;
  tasks: TaskTemplateTaskDefinition[];
}