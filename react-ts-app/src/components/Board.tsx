// src/components/Board.tsx
import React, { useState, useEffect } from 'react';
import useTaskStore from '../store/useTaskStore';
import TaskColumn from './TaskColumn';
import PrintSettings from './PrintSettings';
import TaskModal from './TaskModal';
import StatsPanel from './StatsPanel';
import DataManagementPanel from './DataManagementPanel';
import { useHotkeys, Options } from 'react-hotkeys-hook';
import { v4 as uuidv4 } from 'uuid';
import { Task } from '../types';


const hotkeyOptions: Options = {
  enableOnFormTags: false,
  preventDefault: true,
};

const Board: React.FC = () => {
  const columns = useTaskStore((state) => state.columns);
  const tasks = useTaskStore((state) => state.tasks);
  const rootTaskIds = useTaskStore((state) => state.rootTaskIds);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const editingTaskId = useTaskStore((state) => state.editingTaskId);
  const setActiveColumns = useTaskStore((state) => state.setActiveColumns);
  const setSelectedTaskId = useTaskStore((state) => state.setSelectedTaskId);
  const setEditingTaskId = useTaskStore((state) => state.setEditingTaskId);
  const toggleTaskCompletion = useTaskStore((state) => state.toggleTaskCompletion);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const addTask = useTaskStore((state) => state.addTask);

  const [selectedTaskHierarchy, setSelectedTaskHierarchy] = useState<string[]>([]);
  const [focusedColumnIdForPrint, setFocusedColumnIdForPrint] = useState<string | null>(null);

  const handleTaskAdded = (newTaskId: string, taskParentId: string | null) => {
    const currentTasks = useTaskStore.getState().tasks;
    const newTask = currentTasks[newTaskId];
    if (!newTask) {
      // console.error('[Board.tsx] handleTaskAdded - newTask not found in store!', newTaskId); // エラーログは残す選択肢もある
      return;
    }

    let newHierarchy: string[] = [];
    if (taskParentId) {
      const buildHierarchy = (currentId: string, path: string[]): string[] => {
        const t = currentTasks[currentId];
        if (!t) return path;
        path.unshift(currentId);
        return t.parentId ? buildHierarchy(t.parentId, path) : path;
      };
      newHierarchy = buildHierarchy(taskParentId, []);
    }

    const fullNewHierarchy = [...newHierarchy, newTaskId];

    setSelectedTaskId(newTaskId);
    setSelectedTaskHierarchy(fullNewHierarchy);
    setActiveColumns(fullNewHierarchy);
  };

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEditInModal, setTaskToEditInModal] = useState<Task | null>(null);
  const [modalParentId, setModalParentId] = useState<string | null>(null);


  useEffect(() => {
    setActiveColumns([]);
    setSelectedTaskId(null);
  }, [setActiveColumns, setSelectedTaskId]);

  const handleOpenDetailEditModal = (taskId: string) => {
    const task = tasks[taskId];
    if (task) {
      setTaskToEditInModal(task);
      setModalParentId(task.parentId);
      setIsTaskModalOpen(true);
    }
  };

  const handleOpenNewTaskModal = (pId: string | null) => {
    setTaskToEditInModal(null);
    setModalParentId(pId);
    setIsTaskModalOpen(true);
  };

  const handleTaskClick = (taskId: string) => {
    if (editingTaskId && editingTaskId !== taskId) {
        return;
    }
    const task = tasks[taskId];
    if (!task) return;

    const parentColumn = columns.find(col => col.taskIds.includes(taskId));
    if (parentColumn) {
        setFocusedColumnIdForPrint(parentColumn.id);
    } else {
        if (rootTaskIds.includes(taskId)) {
            const rootColumn = columns.find(col => col.parentTaskId === null && col.level === 0);
            if (rootColumn) {
                 setFocusedColumnIdForPrint(rootColumn.id);
            } else {
                 setFocusedColumnIdForPrint(null);
            }
        } else {
            setFocusedColumnIdForPrint(null);
        }
    }

    if (editingTaskId === taskId) {
        setEditingTaskId(null);
        return;
    }
    if (editingTaskId && editingTaskId !== taskId) return;

    setSelectedTaskId(taskId);

    let finalHierarchy: string[] = [];
    const buildHierarchy = (currentId: string, currentPath: string[]): string[] => {
        const t = tasks[currentId];
        if (!t) return currentPath;
        currentPath.unshift(currentId);
        if (t.parentId) {
            return buildHierarchy(t.parentId, currentPath);
        }
        return currentPath;
    };
    finalHierarchy = buildHierarchy(taskId, []);
    setSelectedTaskHierarchy(finalHierarchy);
    setActiveColumns(finalHierarchy);
  };

  useHotkeys('space', (e) => {
    if (!editingTaskId && selectedTaskId) {
      toggleTaskCompletion(selectedTaskId);
    }
  }, { ...hotkeyOptions, preventDefault: true }, [selectedTaskId, toggleTaskCompletion, editingTaskId]);

  useHotkeys('delete', (e) => {
    if (!editingTaskId && selectedTaskId) {
      const task = tasks[selectedTaskId];
      if (task && window.confirm(`タスク「${task.title}」を削除しますか？ (Deleteキー)`)) {
        const taskToDelete = tasks[selectedTaskId];
        deleteTask(selectedTaskId);

         if(taskToDelete) {
            let newHierarchy = [...selectedTaskHierarchy];
            if (newHierarchy.length > 0 && newHierarchy[newHierarchy.length -1] === selectedTaskId) {
                newHierarchy.pop();
            }
            const nextSelectedId = newHierarchy.length > 0 ? newHierarchy[newHierarchy.length -1] : (taskToDelete.parentId || null);

            setSelectedTaskHierarchy(newHierarchy);
            setActiveColumns(newHierarchy);
            setSelectedTaskId(nextSelectedId);
         } else {
            setSelectedTaskHierarchy([]);
            setActiveColumns([]);
            setSelectedTaskId(null);
         }
      }
    }
  }, { ...hotkeyOptions, preventDefault: true }, [selectedTaskId, tasks, deleteTask, selectedTaskHierarchy, setActiveColumns, setSelectedTaskId, setSelectedTaskHierarchy, editingTaskId]);

  useHotkeys('enter', (e) => {
    if (editingTaskId) return;

    const taskTitle = prompt('新しいタスク名を入力してください (Enter):');
    if (taskTitle && taskTitle.trim() !== '') {
      let parentOfNewTask: string | null = null;
      if (selectedTaskId) {
        const selectedTaskData = tasks[selectedTaskId];
        parentOfNewTask = selectedTaskData ? selectedTaskData.parentId : null;
      } else {
        parentOfNewTask = null;
      }
      const newTask: Task = {
        id: uuidv4(),
        title: taskTitle.trim(),
        completed: false,
        parentId: parentOfNewTask,
        childrenIds: [],
        createdAt: new Date(),
        completedAt: null,
        tags: [],
        priority: 'medium',
      };
      addTask(newTask);
      setSelectedTaskId(newTask.id);
      const newHierarchy = parentOfNewTask ? selectedTaskHierarchy.slice(0, selectedTaskHierarchy.indexOf(parentOfNewTask) + 1) : [];
      if (parentOfNewTask && !newHierarchy.includes(parentOfNewTask) && tasks[parentOfNewTask]) newHierarchy.push(parentOfNewTask);
      setActiveColumns(newHierarchy);
    }
  }, { ...hotkeyOptions, enableOnFormTags: false }, [selectedTaskId, tasks, addTask, setActiveColumns, setSelectedTaskId, editingTaskId, selectedTaskHierarchy]);

  useHotkeys('ctrl+enter', (e) => {
    if (editingTaskId) return;
    if (!selectedTaskId) {
      alert('サブタスクを作成する親タスクを選択してください。');
      return;
    }
    const parentTaskData = tasks[selectedTaskId];
    if (!parentTaskData) return;

    const taskTitle = prompt(`「${parentTaskData.title}」のサブタスク名を入力してください (Ctrl+Enter):`);
    if (taskTitle && taskTitle.trim() !== '') {
      const newTask: Task = {
        id: uuidv4(),
        title: taskTitle.trim(),
        completed: false,
        parentId: selectedTaskId,
        childrenIds: [],
        createdAt: new Date(),
        completedAt: null,
        tags: [],
        priority: 'medium',
      };
      addTask(newTask);
      setSelectedTaskId(newTask.id);
      const newHierarchy = [...selectedTaskHierarchy];
      if(!newHierarchy.includes(selectedTaskId)) newHierarchy.push(selectedTaskId);
      setActiveColumns(newHierarchy);
      setEditingTaskId(newTask.id);
    }
  }, { ...hotkeyOptions, enableOnFormTags: false }, [selectedTaskId, tasks, addTask, setSelectedTaskId, editingTaskId, selectedTaskHierarchy, setActiveColumns, setEditingTaskId]);

  useHotkeys('f2', (e) => {
    if (selectedTaskId && !editingTaskId) {
      setEditingTaskId(selectedTaskId);
    }
  }, { ...hotkeyOptions, enableOnFormTags: true, preventDefault: true }, [selectedTaskId, editingTaskId, setEditingTaskId]);


  return (
    <div className="flex flex-row h-screen bg-white" tabIndex={-1} >
      <StatsPanel />
      <div className="flex flex-col flex-grow">
        <div className="flex flex-row flex-grow overflow-x-auto bg-gray-50 p-3">
          {columns.map(column => (
            <TaskColumn
              key={column.id}
              columnId={column.id}
              onTaskClick={handleTaskClick}
              onOpenDetailEditModal={handleOpenDetailEditModal}
              onOpenNewTaskModal={handleOpenNewTaskModal}
            />
          ))}
          {columns.length === 0 && <p className="p-4 text-gray-500">表示するカラムがありません。</p>}
        </div>
        <div className="border-t"> {/* フッター要素をまとめるコンテナ */}
            <PrintSettings columnIdToPrint={focusedColumnIdForPrint} />
            <DataManagementPanel />
        </div>
      </div>
      {isTaskModalOpen && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          taskToEdit={taskToEditInModal}
          parentId={modalParentId}
          onTaskAdded={handleTaskAdded}
        />
      )}
    </div>
  );
};

export default Board;
