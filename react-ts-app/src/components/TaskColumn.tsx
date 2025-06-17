// src/components/TaskColumn.tsx
import React from 'react';
import useTaskStore from '../store/useTaskStore';
import TaskItem from './TaskItem';
import { v4 as uuidv4 } from 'uuid'; // ID生成のため

interface TaskColumnProps {
  columnId: string;
  onTaskClick: (taskId: string) => void; // Board から渡される
  onOpenDetailEditModal: (taskId: string) => void; // ★ Boardから渡される
  onOpenNewTaskModal: (parentId: string | null) => void; // ★ Boardから渡される
}

const TaskColumn: React.FC<TaskColumnProps> = ({ columnId, onTaskClick, onOpenDetailEditModal, onOpenNewTaskModal }) => {
  const column = useTaskStore((state) => state.columns.find(col => col.id === columnId));
  const tasks = useTaskStore((state) => state.tasks);
  // addTask はモーダル内で行うため、ここでは不要に
  // const addTask = useTaskStore((state) => state.addTask);

  if (!column) {
    return <div className="w-64 p-2 border-r">カラムが見つかりません</div>;
  }

  const columnTasks = column.taskIds.map(taskId => tasks[taskId]).filter(Boolean);
  const parentTask = column.parentTaskId ? tasks[column.parentTaskId] : null;

  // handleAddNewTask は onOpenNewTaskModal を呼び出すように変更
  const handleInitiateNewTask = () => {
    onOpenNewTaskModal(column.parentTaskId);
  };

  return (
    <div className="w-72 p-3 border-r bg-gray-50 flex-shrink-0 h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-2">
        {parentTask ? `${parentTask.title} のサブタスク` : 'ルートタスク'} (Level {column.level})
      </h2>
      <div className="flex-grow overflow-y-auto">
        {columnTasks.length > 0 ? (
          columnTasks.map(task => {
            if (!task) return null;
            return (
              <TaskItem
                key={task.id}
                taskId={task.id}
                onTaskClick={onTaskClick}
                onOpenDetailEdit={onOpenDetailEditModal} // ★ Propを渡す
              />
            );
          })
        ) : (
          <p className="text-gray-500">このカラムにはタスクがありません。</p>
        )}
      </div>
      <button
        onClick={handleInitiateNewTask} // ★ 変更
        className="mt-2 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm" // text-sm追加
      >
        + 新規タスク追加
      </button>
    </div>
  );
};

export default TaskColumn;
