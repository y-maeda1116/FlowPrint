// src/store/useTaskStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Task, TaskColumn, TaskPriority, TaskTemplate, TaskTemplateTaskDefinition, ExportedData, ExportedTask } from '../types'; // 型をインポート
import { v4 as uuidv4 } from 'uuid';

// TaskTemplateTaskDefinition と TaskTemplate は既にインポートされているか、ここで定義されているはず
// If not, they should be imported from types.ts or defined here.
// Assuming TaskTemplate is already correctly defined/imported as per previous steps.

interface TaskState {
  tasks: Record<string, Task>;
  columns: TaskColumn[];
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
  taskTemplates: Record<string, TaskTemplate>;
  addTemplate: (template: TaskTemplate) => void;
  deleteTemplate: (templateId: string) => void;
  applyTemplate: (templateId: string, parentId: string | null, startDateTime?: Date) => string[];

  // Selectors (メソッド形式)
  getCompletedTasksTotalCount: () => number;
  getTasksCompletedTodayCount: () => number;
  getTasksCompletedThisWeekCount: () => number;
  getTasksCompletedThisMonthCount: () => number;
  importState: (data: ExportedData) => boolean; // ★ アクションの型定義
}

const initialCoreState = {
  tasks: {
    'task-1': { id: 'task-1', title: '親タスク 1 (サンプル)', description: "これは親タスク1の説明です。", completed: false, parentId: null, childrenIds: ['task-2', 'task-3'], createdAt: new Date(), completedAt: null, tags: [], priority: 'medium' as TaskPriority },
    'task-2': { id: 'task-2', title: '子タスク 1-1 (サンプル)', description: "子タスク1-1の詳細。", completed: false, parentId: 'task-1', childrenIds: [], createdAt: new Date(), completedAt: null, tags: [], priority: 'low' as TaskPriority },
    'task-3': { id: 'task-3', title: '子タスク 1-2 (サンプル)', completed: false, parentId: 'task-1', childrenIds: ['task-4'], createdAt: new Date(), completedAt: null, tags: [], priority: 'high' as TaskPriority },
    'task-4': { id: 'task-4', title: '孫タスク 1-2-1 (サンプル)', completed: true, parentId: 'task-3', childrenIds: [], createdAt: new Date(), completedAt: new Date(), tags: [], priority: 'medium' as TaskPriority },
    'task-5': { id: 'task-5', title: '親タスク 2 (サンプル)', completed: false, parentId: null, childrenIds: [], createdAt: new Date(), completedAt: null, tags: [], priority: 'medium' as TaskPriority },
  },
  rootTaskIds: ['task-1', 'task-5'],
  taskTemplates: {
    'template-morning': {
      id: 'template-morning',
      name: '朝の準備ルーティン',
      tasks: [
        { title: '起床・着替え', estimatedMinutes: 15, description: "アラームで起き、今日の服装を選ぶ。" },
        { title: '朝食', estimatedMinutes: 20, description: "シリアルとコーヒーを準備して食べる。" },
        { title: '歯磨き・洗顔', estimatedMinutes: 10 },
        { title: '今日の予定確認', estimatedMinutes: 5, priority: 'high' as TaskPriority },
      ],
    },
    'template-project-kickoff': {
      id: 'template-project-kickoff',
      name: 'プロジェクト開始準備',
      tasks: [
        { title: '要件定義確認', priority: 'high' as TaskPriority, estimatedMinutes: 120 },
        { title: 'タスク洗い出し', priority: 'high' as TaskPriority, children: [
            {title: 'WBS作成', estimatedMinutes: 60}, {title: '担当者割り当て', estimatedMinutes: 30}
        ]},
        { title: 'スケジュール作成', priority: 'medium' as TaskPriority, estimatedMinutes: 90 },
        { title: 'キックオフミーティング設定', priority: 'low' as TaskPriority, tags: ['meeting']},
      ]
    }
  },
};

const nonPersistentState = {
  columns: [],
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
        taskTemplates: { ...state.taskTemplates, [template.id]: template },
      })),
      deleteTemplate: (templateId) => set((state) => {
        const newTemplates = { ...state.taskTemplates };
        delete newTemplates[templateId];
        return { taskTemplates: newTemplates };
      }),
      applyTemplate: (templateId, parentId, startDateTime) => {
        const { taskTemplates } = get();
        const template = taskTemplates[templateId];
        if (!template) return [];

        const generatedTopLevelTaskIds: string[] = [];
        let tempTasks: Record<string, Task> = {};
        let tempRootTaskIds: string[] = [];
        let tempParentChildMap: Record<string, string[]> = {};

        const processTaskDefinition = (
          taskDef: TaskTemplateTaskDefinition,
          currentParentId: string | null
        ): string => {
          const newTaskId = uuidv4();
          const newTask: Task = {
            id: newTaskId,
            title: taskDef.title,
            description: taskDef.description || undefined,
            completed: false,
            parentId: currentParentId,
            childrenIds: [],
            createdAt: startDateTime || new Date(),
            completedAt: null,
            estimatedMinutes: taskDef.estimatedMinutes || undefined,
            priority: taskDef.priority || 'medium',
            tags: taskDef.tags || [],
          };
          tempTasks[newTaskId] = newTask;
          if (currentParentId) {
            if (!tempParentChildMap[currentParentId]) {
              tempParentChildMap[currentParentId] = [];
            }
            tempParentChildMap[currentParentId].push(newTaskId);
          } else {
            tempRootTaskIds.push(newTaskId);
            generatedTopLevelTaskIds.push(newTaskId);
          }

          if (taskDef.children && taskDef.children.length > 0) {
            taskDef.children.forEach((childDef: TaskTemplateTaskDefinition) => processTaskDefinition(childDef, newTaskId));

          }
          return newTaskId;
        };

        //template.tasks.forEach(taskDef => processTaskDefinition(taskDef, parentId));
        template.tasks.forEach((taskDef: TaskTemplateTaskDefinition) => { /* ... */ });

        Object.keys(tempParentChildMap).forEach(pId => {
          if (tempTasks[pId]) {
            tempTasks[pId].childrenIds = tempParentChildMap[pId];
          }
        });

        set(state => {
          const finalTasks = { ...state.tasks, ...tempTasks };
          let finalRootTaskIds = [...state.rootTaskIds];
          tempRootTaskIds.forEach(id => {
            if (!finalRootTaskIds.includes(id)) finalRootTaskIds.push(id);
          });

          if (parentId && finalTasks[parentId]) {
            const parentTask = finalTasks[parentId];
            const newChildrenForParent = new Set([...parentTask.childrenIds, ...(tempParentChildMap[parentId] || [])]);
            finalTasks[parentId] = { ...parentTask, childrenIds: Array.from(newChildrenForParent) };
          }

          let newColumns = state.columns.map(col => {
            if (col.parentTaskId === parentId) {
              const taskIdsSet = new Set(col.taskIds);
              (tempParentChildMap[parentId || ''] || tempRootTaskIds).forEach(tid => taskIdsSet.add(tid));
              return { ...col, taskIds: Array.from(taskIdsSet) };
            }
            return col;
          });
           if (!parentId) {
                const rootColumnIndex = newColumns.findIndex(col => col.parentTaskId === null && col.level === 0);
                if (rootColumnIndex !== -1) {
                    const taskIdsSet = new Set(newColumns[rootColumnIndex].taskIds);
                    tempRootTaskIds.forEach(tid => taskIdsSet.add(tid));
                    newColumns[rootColumnIndex] = { ...newColumns[rootColumnIndex], taskIds: Array.from(taskIdsSet) };
                }
           }
          return { tasks: finalTasks, rootTaskIds: finalRootTaskIds, columns: newColumns };
        });
        return generatedTopLevelTaskIds;
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
        columns: [...state.columns, column],
      })),

      removeColumn: (columnId) => set((state) => ({
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
              const childColumn = {
                id: `column-${taskId}-${Date.now()}`,
                taskIds: task.childrenIds.filter(id => !!state.tasks[id]),
                parentTaskId: taskId,
                level: level++,
              };
              newColumns.push(childColumn);
            }
          }
          const finalColumns = newColumns.slice(0, 5);
          return { columns: finalColumns }; // Ensure a new reference is returned
        });
      },

      // --- Selectors for Statistics ---
      getCompletedTasksTotalCount: () => {
        const { tasks } = get();
        return Object.values(tasks).filter(task => task.completed).length;
      },
      getTasksCompletedTodayCount: () => {
        const { tasks } = get();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return Object.values(tasks).filter(
          task => task.completed && task.completedAt && new Date(task.completedAt) >= todayStart
        ).length;
      },
      getTasksCompletedThisWeekCount: () => {
        const { tasks } = get();
        const now = new Date();
        const today = now.getDay();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (today === 0 ? 6 : today - 1)); // Monday as start of week
        weekStart.setHours(0, 0, 0, 0);
        return Object.values(tasks).filter(
          task => task.completed && task.completedAt && new Date(task.completedAt) >= weekStart
        ).length;
      },
      getTasksCompletedThisMonthCount: () => {
        const { tasks } = get();
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);
        return Object.values(tasks).filter(
          task => task.completed && task.completedAt && new Date(task.completedAt) >= monthStart
        ).length;
      },

      // --- Data Import/Export Actions ---
      importState: (data: ExportedData) => {
        if (!data || typeof data.tasks !== 'object' || !Array.isArray(data.rootTaskIds) || typeof data.taskTemplates !== 'object') {
          console.error("Invalid data format for import: missing essential keys.");
          return false;
        }
        // Consider adding a version check here: if (data.version !== CURRENT_APP_DATA_VERSION) ...

        try {
          const rehydratedTasks = Object.fromEntries(
            Object.entries(data.tasks).map(([id, task]: [string, ExportedTask]) => [ // Explicitly type task as ExportedTask
              id,
              {
                ...task,
                createdAt: new Date(task.createdAt),
                completedAt: task.completedAt ? new Date(task.completedAt) : null,
              },
            ])
          );

          // TaskTemplate dates: Assuming TaskTemplate structure does not contain Date objects that need rehydration.
          // If it did, a similar rehydration process would be needed for data.taskTemplates.

          set({
            tasks: rehydratedTasks,
            rootTaskIds: data.rootTaskIds,
            taskTemplates: data.taskTemplates as Record<string, TaskTemplate>, // Cast if confident about structure
            selectedTaskId: null,
            editingTaskId: null,
            columns: [], // Columns will be rebuilt by setActiveColumns
          });
          // It's crucial that after import, UI (e.g., Board) calls setActiveColumns([])
          // to rebuild the column structure based on the new rootTaskIds and tasks.
          // Returning true indicates success, UI can then trigger column refresh.
          return true;
        } catch (error) {
            console.error("Error during data rehydration in importState:", error);
            return false;
        }
      },
    }),
    {
      name: 'flowprint-task-store-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tasks: state.tasks,
        rootTaskIds: state.rootTaskIds,
        taskTemplates: state.taskTemplates,
      }),
      onRehydrateStorage: () => {
        console.log("Attempting to rehydrate tasks from storage...");
        return (hydratedStateFromStorage, error) => {
          if (error) {
            console.error("Failed to rehydrate state from storage:", error);
            return;
          }
          if (hydratedStateFromStorage && hydratedStateFromStorage.tasks) {
            console.log("Tasks found in storage, rehydrating dates...");
            for (const taskId in hydratedStateFromStorage.tasks) {
                const task = (hydratedStateFromStorage.tasks as Record<string,Task>)[taskId];
                if (task.createdAt && typeof task.createdAt === 'string') {
                    task.createdAt = new Date(task.createdAt);
                }
                if (task.completedAt && typeof task.completedAt === 'string') {
                    task.completedAt = new Date(task.completedAt);
                }
            }
          } else {
            console.log("No tasks found in storage or hydratedState is undefined.");
          }
        };
      },
      migrate: (persistedState: any, version: number) => {
        return persistedState as TaskState;
      },
      version: 0,
    }
  )
);

export default useTaskStore;
