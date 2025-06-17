// src/components/Board.tsx
import React, { useState, useEffect } from 'react';
import useTaskStore from '../store/useTaskStore';
import TaskColumn from './TaskColumn';
import PrintSettings from './PrintSettings';
import TaskModal from './TaskModal'; // ★ TaskModal をインポート
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
  const rootTaskIds = useTaskStore((state) => state.rootTaskIds); // For handleTaskClick
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

  // ★ Modal State
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
      setModalParentId(task.parentId); // Not strictly for edit, but good for context
      setIsTaskModalOpen(true);
    }
  };

  const handleOpenNewTaskModal = (pId: string | null) => {
    setTaskToEditInModal(null); // Ensure it's for a new task
    setModalParentId(pId);
    setIsTaskModalOpen(true);
  };

  const handleTaskClick = (taskId: string) => {
    if (editingTaskId && editingTaskId !== taskId) { // 他のタスクが編集中なら選択変更しない
        // もし編集中タスクをクリックしたら編集解除するなら以下のロジック
        // if (editingTaskId === taskId) setEditingTaskId(null);
        return;
    }
    const task = tasks[taskId];
    if (!task) return;

    const parentColumn = columns.find(col => col.taskIds.includes(taskId));
    if (parentColumn) {
        setFocusedColumnIdForPrint(parentColumn.id);
    } else {
        if (rootTaskIds.includes(taskId)) { // Use rootTaskIds from store
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
    setSelectedTaskHierarchy(finalHierarchy); // このローカルステートも更新
    setActiveColumns(finalHierarchy);
  };

  useHotkeys('space', (e) => {
    if (!editingTaskId && selectedTaskId) { // 編集中でない場合のみ
      toggleTaskCompletion(selectedTaskId);
    }
  }, { ...hotkeyOptions, preventDefault: true }, [selectedTaskId, toggleTaskCompletion, editingTaskId]);

  useHotkeys('delete', (e) => {
    if (!editingTaskId && selectedTaskId) { // 編集中でない場合のみ
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

  // ★: Enterキー - 新規タスク作成
  useHotkeys('enter', (e) => {
    if (editingTaskId) return; // 編集中は新規作成しない

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
      setSelectedTaskId(newTask.id); // 新しく追加したタスクを選択
      // カラム表示更新のため、新しいタスクの階層を構築してsetActiveColumnsを呼ぶ
      const newHierarchy = parentOfNewTask ? selectedTaskHierarchy.slice(0, selectedTaskHierarchy.indexOf(parentOfNewTask) + 1) : [];
      if (parentOfNewTask && !newHierarchy.includes(parentOfNewTask) && tasks[parentOfNewTask]) newHierarchy.push(parentOfNewTask);

      setActiveColumns(newHierarchy); // 親の階層でカラムを更新
                                     // もし兄弟タスクとして追加した場合、その親カラムが再描画される
                                     // ルートならルートカラムが再描画
      // 必要であれば、さらに新しいタスクを編集モードにする: setEditingTaskId(newTask.id);
    }
  }, { ...hotkeyOptions, enableOnFormTags: false }, [selectedTaskId, tasks, addTask, setActiveColumns, setSelectedTaskId, editingTaskId, selectedTaskHierarchy]);

  // ★: Ctrl+Enterキー - 新規サブタスク作成
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
      setSelectedTaskId(newTask.id); // 新しいタスクを選択
      // 新しいタスクの親を含む階層でカラムを更新
      const newHierarchy = [...selectedTaskHierarchy];
      if(!newHierarchy.includes(selectedTaskId)) newHierarchy.push(selectedTaskId); // 親が階層になければ追加

      setActiveColumns(newHierarchy); // 親の階層 + 新しい子カラムが表示されるように
      setEditingTaskId(newTask.id); // 新しく追加したタスクを編集モードにする
    }
  }, { ...hotkeyOptions, enableOnFormTags: false }, [selectedTaskId, tasks, addTask, setSelectedTaskId, editingTaskId, selectedTaskHierarchy, setActiveColumns, setEditingTaskId]);

  // ★: F2キー - タスク名編集
  useHotkeys('f2', (e) => {
    if (selectedTaskId && !editingTaskId) {
      setEditingTaskId(selectedTaskId);
    }
  }, { ...hotkeyOptions, enableOnFormTags: true, preventDefault: true }, [selectedTaskId, editingTaskId, setEditingTaskId]);


  return (
    <div className="flex flex-row h-screen bg-gray-100 overflow-x-auto" tabIndex={-1} >
      {columns.map(column => (
        <TaskColumn key={column.id} columnId={column.id} onTaskClick={handleTaskClick} />
      ))}
      {columns.length === 0 && <p className="p-4">表示するカラムがありません。タスクをクリックして詳細を展開してください。</p>}
    </div>
  );
};

export default Board;
