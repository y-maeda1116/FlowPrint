// src/store/useTaskStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Task, TaskColumn } from '../types';
import { v4 as uuidv4 } from 'uuid'; // For template task IDs if needed

export interface TaskTemplate { // ★ TaskTemplateインターフェース定義
  id: string;
  name: string;
  tasks: Array<{ // Task作成に必要な情報（IDや親子関係、日時は適用時に決定）
    title: string;
    description?: string;
    estimatedMinutes?: number;
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
    children?: Array<Omit<TaskTemplate['tasks'][0], 'children'>>;
  }>;
}

interface TaskState {
  tasks: Record<string, Task>;
  columns: TaskColumn[]; // UI表示用なので永続化しないが、型定義としては必要
  rootTaskIds: string[];
  selectedTaskId: string | null;
  editingTaskId: string | null;

  // Actions
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updatedProperties: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  toggleTaskCompletion: (taskId: string) => void;
  addColumn: (column: TaskColumn) => void;
  removeColumn: (columnId: string) => void;
  setActiveColumns: (taskIds: string[]) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  setEditingTaskId: (taskId: string | null) => void;
  taskTemplates: Record<string, TaskTemplate>; // ★ テンプレート保存用
  addTemplate: (template: TaskTemplate) => void; // ★
  deleteTemplate: (templateId: string) => void; // ★
  applyTemplate: (templateId: string, parentId: string | null, startDateTime?: Date) => string[]; // ★
}

// 初期状態を定義
const initialCoreState = {
  tasks: {
    'task-1': { id: 'task-1', title: '親タスク 1 (サンプル)', description: "これは親タスク1の説明です。", completed: false, parentId: null, childrenIds: ['task-2', 'task-3'], createdAt: new Date(), completedAt: null, tags: [], priority: 'medium' },
    'task-2': { id: 'task-2', title: '子タスク 1-1 (サンプル)', description: "子タスク1-1の詳細。", completed: false, parentId: 'task-1', childrenIds: [], createdAt: new Date(), completedAt: null, tags: [], priority: 'low' },
    'task-3': { id: 'task-3', title: '子タスク 1-2 (サンプル)', completed: false, parentId: 'task-1', childrenIds: ['task-4'], createdAt: new Date(), completedAt: null, tags: [], priority: 'high' },
    'task-4': { id: 'task-4', title: '孫タスク 1-2-1 (サンプル)', completed: true, parentId: 'task-3', childrenIds: [], createdAt: new Date(), completedAt: new Date(), tags: [], priority: 'medium' },
    'task-5': { id: 'task-5', title: '親タスク 2 (サンプル)', completed: false, parentId: null, childrenIds: [], createdAt: new Date(), completedAt: null, tags: [], priority: 'medium' },
  },
  rootTaskIds: ['task-1', 'task-5'],
  taskTemplates: { // ★ 初期テンプレート例
    'template-morning': {
      id: 'template-morning',
      name: '朝の準備ルーティン',
      tasks: [
        { title: '起床・着替え', estimatedMinutes: 15, description: "アラームで起き、今日の服装を選ぶ。" },
        { title: '朝食', estimatedMinutes: 20, description: "シリアルとコーヒーを準備して食べる。" },
        { title: '歯磨き・洗顔', estimatedMinutes: 10 },
        { title: '今日の予定確認', estimatedMinutes: 5, priority: 'high' },
      ],
    },
    'template-project-kickoff': {
      id: 'template-project-kickoff',
      name: 'プロジェクト開始準備',
      tasks: [
        { title: '要件定義確認', priority: 'high', estimatedMinutes: 120 },
        { title: 'タスク洗い出し', priority: 'high', children: [
            {title: 'WBS作成', estimatedMinutes: 60}, {title: '担当者割り当て', estimatedMinutes: 30}
        ]},
        { title: 'スケジュール作成', priority: 'medium', estimatedMinutes: 90 },
        { title: 'キックオフミーティング設定', priority: 'low', tags: ['meeting']},
      ]
    }
  },
};

const nonPersistentState = {
  columns: [], // columns は起動時に setActiveColumns で初期化
  selectedTaskId: null,
  editingTaskId: null,
};


export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      ...initialCoreState,
      ...nonPersistentState,

      setEditingTaskId: (taskId) => set({ editingTaskId: taskId }),
      setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),

      addTemplate: (template) => set((state) => ({
        taskTemplates: { ...state.taskTemplates, [template.id]: template }
      })),
      deleteTemplate: (templateId) => set((state) => {
        const newTemplates = { ...state.taskTemplates };
        delete newTemplates[templateId];
        return { taskTemplates: newTemplates };
      }),
      applyTemplate: (templateId, parentId, startDateTime) => {
        const state = get();
        const template = state.taskTemplates[templateId];
        if (!template) return [];

        const createdTaskIds: string[] = [];

        const createTasksFromTemplate = (
          templateTasks: TaskTemplate['tasks'],
          currentParentId: string | null
        ) => {
          for (const taskDef of templateTasks) {
            const newTask: Task = {
              id: uuidv4(),
              title: taskDef.title,
              description: taskDef.description,
              completed: false,
              parentId: currentParentId,
              childrenIds: [],
              createdAt: startDateTime || new Date(), // TODO: startDateTime と連続タスクの開始時間考慮
              completedAt: null,
              estimatedMinutes: taskDef.estimatedMinutes,
              priority: taskDef.priority || 'medium',
              tags: taskDef.tags || [],
            };
            state.addTask(newTask); // addTaskを直接呼ぶ代わりに、ここで状態変更ロジックを再利用するか、一括で追加する
            createdTaskIds.push(newTask.id);

            if (taskDef.children && taskDef.children.length > 0) {
              const childIds = createTasksFromTemplate(taskDef.children, newTask.id);
              // tasks[newTask.id] を直接変更するのは immer がないと危険なので set を使う
              set(s => ({
                tasks: {
                  ...s.tasks,
                  [newTask.id]: { ...s.tasks[newTask.id], childrenIds: childIds }
                }
              }));
            }
          }
          return templateTasks.map(t => createdTaskIds[createdTaskIds.length - templateTasks.length + templateTasks.indexOf(t)]); // HACK: IDを正しく引く方法改善要
        };

        // HACK: applyTemplate内でのaddTask/setの呼び出しは複雑になるため、
        // 本来は一連のタスクを準備してから一括でsetするのが望ましい。
        // ここでは簡略化のため、トップレベルのタスクのみ生成する例を示す。
        // (上記createTasksFromTemplateは再帰的なID処理に課題あり)

        const topLevelTaskIds: string[] = [];
        template.tasks.forEach(taskDef => {
            const newTask: Task = {
              id: uuidv4(),
              title: taskDef.title,
              description: taskDef.description,
              completed: false,
              parentId: parentId,
              childrenIds: [], // Children will be processed recursively later if needed
              createdAt: new Date(),
              completedAt: null,
              estimatedMinutes: taskDef.estimatedMinutes,
              priority: taskDef.priority || 'medium',
              tags: taskDef.tags || [],
            };
            // ここでaddTaskを呼ぶのは、setの外部なので注意。
            // ストアアクション内で別のストアアクションを呼ぶのは通常はOK。
            get().addTask(newTask); // get() で最新のaddTaskを取得して実行
            topLevelTaskIds.push(newTask.id);
            // TODO: サブタスクの再帰的生成と childrenIds の設定
        });

        // setActiveColumnsなどを呼んでUIを更新する必要があるかもしれない
        return topLevelTaskIds;
      },

      addTask: (task) => set((state) => {
        const newTasks = { ...state.tasks, [task.id]: task };
        let newRootTaskIds = [...state.rootTaskIds];
        if (!task.parentId) {
          if(!newRootTaskIds.includes(task.id)) newRootTaskIds.push(task.id);
        } else {
          const parent = newTasks[task.parentId];
          if (parent) {
            const childrenIdsSet = new Set(parent.childrenIds);
            childrenIdsSet.add(task.id);
            newTasks[task.parentId] = { ...parent, childrenIds: Array.from(childrenIdsSet) };
          }
        }
        return { tasks: newTasks, rootTaskIds: newRootTaskIds };
      }),

      updateTask: (taskId, updatedProperties) => set((state) => {
        const taskToUpdate = state.tasks[taskId];
        if (!taskToUpdate) return state;
        // createdAt は更新しない
        const { createdAt, ...restOfProperties } = updatedProperties;
        return {
          tasks: {
            ...state.tasks,
            [taskId]: { ...taskToUpdate, ...restOfProperties },
          },
        };
      }),

      deleteTask: (taskId) => set((state) => {
        const newTasks = { ...state.tasks };
        const taskToDelete = newTasks[taskId];
        if (!taskToDelete) return state;

        delete newTasks[taskId];

        if (taskToDelete.parentId) {
          const parent = newTasks[taskToDelete.parentId];
          if (parent) {
            newTasks[taskToDelete.parentId] = {
              ...parent,
              childrenIds: parent.childrenIds.filter(id => id !== taskId),
            };
          }
        }
        const newRootTaskIds = state.rootTaskIds.filter(id => id !== taskId);
        // columns は setActiveColumns で管理
        const newSelectedTaskId = state.selectedTaskId === taskId ? null : state.selectedTaskId;
        const newEditingTaskId = state.editingTaskId === taskId ? null : state.editingTaskId;

        return { tasks: newTasks, rootTaskIds: newRootTaskIds, selectedTaskId: newSelectedTaskId, editingTaskId: newEditingTaskId };
      }),

      toggleTaskCompletion: (taskId) => set((state) => {
        const task = state.tasks[taskId];
        if (!task) return state;
        return {
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...task,
              completed: !task.completed,
              completedAt: !task.completed ? new Date() : null,
            },
          },
        };
      }),

      addColumn: (column) => set((state) => ({
         // columnsは動的管理なので、このアクションは現状あまり使われない
        columns: [...state.columns, column],
      })),

      removeColumn: (columnId) => set((state) => ({
        // columnsは動的管理
        columns: state.columns.filter(col => col.id !== columnId),
      })),

      setActiveColumns: (selectedTaskIdsHierarchy: string[]) => {
        set((state) => {
          const newColumns: TaskColumn[] = [];
          let level = 0;

          newColumns.push({
            id: `column-root-${Date.now()}`,
            taskIds: state.rootTaskIds.filter(id => !!state.tasks[id]),
            parentTaskId: null,
            level: level++,
          });

          for (const taskId of selectedTaskIdsHierarchy) {
            const task = state.tasks[taskId];
            if (task && task.childrenIds && task.childrenIds.length > 0) {
              newColumns.push({
                id: `column-${taskId}-${Date.now()}`,
                taskIds: task.childrenIds.filter(id => !!state.tasks[id]),
                parentTaskId: taskId,
                level: level++,
              });
            }
          }
          // カラム数の制限例 (最大5カラム)
          return { columns: newColumns.slice(0, 5) };
        });
      },
    }),
    {
      name: 'flowprint-task-store-v1', // ローカルストレージのキー名 (バージョン変更)
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tasks: state.tasks,
        rootTaskIds: state.rootTaskIds,
        taskTemplates: state.taskTemplates, // ★ テンプレートも永続化
      }),
      onRehydrateStorage: () => {
        console.log("Attempting to rehydrate tasks from storage...");
        return (hydratedStateFromStorage, error) => {
          if (error) {
            console.error("Failed to rehydrate state from storage:", error);
            return;
          }
          // Zustand v4.x.x では hydratedState は (state: S | undefined) => void の形で渡される
          // useTaskStore.setState(...) を使ってマージする形が推奨される場合がある
          if (hydratedStateFromStorage && hydratedStateFromStorage.tasks) {
            console.log("Tasks found in storage, rehydrating dates...");
            const tasksWithDates = Object.fromEntries(
              Object.entries(hydratedStateFromStorage.tasks).map(([id, task]: [string, any]) => {
                return [id, {
                  ...task,
                  createdAt: task.createdAt ? new Date(task.createdAt) : new Date(), // フォールバック
                  completedAt: task.completedAt ? new Date(task.completedAt) : null,
                }];
              })
            );
            // useTaskStore.setState({ tasks: tasksWithDates, rootTaskIds: hydratedStateFromStorage.rootTaskIds || [] });
            // 直接 hydratedState を変更する代わりに、新しいオブジェクトを返す (Zustand のバージョンや onRehydrateStorage の正確なシグネチャによる)
            // 今回は persist のデフォルトの復元挙動に任せつつ、Date変換だけ行う
             if (hydratedStateFromStorage.tasks) { // hydratedStateFromStorageがnullでないことを確認
                for (const taskId in hydratedStateFromStorage.tasks) {
                    const task = (hydratedStateFromStorage.tasks as Record<string,Task>)[taskId];
                    if (task.createdAt && typeof task.createdAt === 'string') {
                        task.createdAt = new Date(task.createdAt);
                    }
                    if (task.completedAt && typeof task.completedAt === 'string') {
                        task.completedAt = new Date(task.completedAt);
                    }
                }
            }
          } else {
            console.log("No tasks found in storage or hydratedState is undefined.");
          }
        };
      },
      migrate: (persistedState: any, version: number) => {
        // 将来的なマイグレーション処理
        // if (version < 1) { ... }
        return persistedState as TaskState;
      },
      version: 0, // 初期バージョン
    }
  )
);

export default useTaskStore;
