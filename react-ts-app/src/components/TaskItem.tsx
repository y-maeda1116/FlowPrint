// src/components/TaskItem.tsx
import React, { useState, useEffect, useRef } from 'react';
import useTaskStore from '../store/useTaskStore';

interface TaskItemProps {
  taskId: string;
  onTaskClick: (taskId: string) => void;
  onOpenDetailEdit: (taskId: string) => void; // ★ 詳細編集モーダルを開くためのコールバック
}

const TaskItem: React.FC<TaskItemProps> = ({ taskId, onTaskClick, onOpenDetailEdit }) => {
  const task = useTaskStore((state) => state.tasks[taskId]);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const editingTaskId = useTaskStore((state) => state.editingTaskId);
  const setEditingTaskId = useTaskStore((state) => state.setEditingTaskId);
  const toggleTaskCompletion = useTaskStore((state) => state.toggleTaskCompletion);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const updateTask = useTaskStore((state) => state.updateTask);

  const [isEditingLocal, setIsEditingLocal] = useState(false); // ローカルの編集状態
  const [editText, setEditText] = useState(task ? task.title : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task) {
      setEditText(task.title);
    }
  }, [task]);

  useEffect(() => {
    if (editingTaskId === taskId) {
      setIsEditingLocal(true);
    } else {
      // This case might be tricky if another item is set to edit while this one is blurring.
      // However, finishEditing() should handle clearing editingTaskId.
      if (isEditingLocal) { // If it was editing and now editingTaskId is different
         // setIsEditingLocal(false); // This could cause issues if blur is not handled yet.
      }
    }
  }, [editingTaskId, taskId, isEditingLocal]);

  useEffect(() => {
    if (isEditingLocal && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingLocal]);

  if (!task) {
    return <div>タスクが見つかりません</div>;
  }
  const isSelected = taskId === selectedTaskId;

  const handleCheckboxChange = () => {
    toggleTaskCompletion(taskId);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`タスク「${task.title}」を削除しますか？`)) {
      deleteTask(taskId);
    }
  };

  const handleTitleClick = () => {
    if (!isEditingLocal) {
      setEditingTaskId(taskId);
    }
  };

  const finishEditing = () => {
    if (editText.trim() === '') {
      setEditText(task.title); // Reset to original if empty
    } else if (editText.trim() !== task.title) {
      updateTask(taskId, { title: editText.trim() });
    }
    setIsEditingLocal(false);
    if(editingTaskId === taskId) {
        setEditingTaskId(null);
    }
  };

  const handleEditBlur = () => {
    setTimeout(() => {
        if (document.activeElement !== inputRef.current) {
            finishEditing();
        }
    }, 0);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishEditing();
    } else if (e.key === 'Escape') {
      setEditText(task.title); // Reset text first
      setIsEditingLocal(false); // Then change local state
      if(editingTaskId === taskId) { // Then clear store state
        setEditingTaskId(null);
      }
    }
  };

  return (
    <div
      className={
        `p-2 border rounded mb-2 cursor-pointer flex justify-between items-center
        ${task.completed ? 'bg-green-100' : 'bg-white'}
        ${isEditingLocal ? 'ring-2 ring-blue-500' : ''}
        ${isSelected && !isEditingLocal ? 'ring-2 ring-blue-500 shadow-md' : 'hover:bg-gray-100'} `
      }
      onClick={() => !isEditingLocal && onTaskClick(taskId)}
    >
      <div className="flex items-center flex-grow min-w-0">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={handleCheckboxChange}
          className="mr-2 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
          disabled={isEditingLocal}
        />
        {isEditingLocal ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleEditBlur}
            onKeyDown={handleEditKeyDown}
            className="border px-1 py-0 w-full text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span onClick={handleTitleClick} className="flex-grow cursor-text truncate" title={task.title}>
            {task.title}
          </span>
        )}
        {task.childrenIds && task.childrenIds.length > 0 && !isEditingLocal && (
          <span className="ml-2 text-xs text-gray-500 flex-shrink-0">({task.childrenIds.length})</span>
        )}
      </div>
      {!isEditingLocal && (
        <div className="flex-shrink-0 space-x-1"> {/* ボタンを横並びにするためのdiv */}
          <button
            onClick={(e) => { e.stopPropagation(); onOpenDetailEdit(taskId); }}
            className="p-1 text-blue-600 hover:text-blue-800 text-xs"
            aria-label={`タスク「${task.title}」の詳細編集`}
            title="詳細編集"
          >
            詳細
            {/* Icon can be added here, e.g. Pencil icon */}
          </button>
          <button
            onClick={handleDeleteClick}
            className="p-1 text-red-500 hover:text-red-700 text-xs"
            aria-label={`タスク「${task.title}」を削除`}
            title="削除"
          >
            削除
            {/* Icon can be added here, e.g. Trash icon */}
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskItem;
