// src/components/StatsPanel.tsx
import React from 'react';
import useTaskStore from '../store/useTaskStore';
import { Task } from '../types'; // Task型をインポート (tasksの型付けのため)

const StatsPanel: React.FC = () => {
  // tasksオブジェクト全体を購読することで、tasksが変更されたときにコンポーネントが再レンダリングされる
  const tasks = useTaskStore(state => state.tasks);

  // 統計計算関数 (コンポーネント内で定義し、購読しているtasksを使用)
  const getCompletedTasksTotalCount = () => {
    return Object.values(tasks).filter(task => task.completed).length;
  };

  const getTasksCompletedTodayCount = () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return Object.values(tasks).filter(
      (task: Task) => task.completed && task.completedAt && new Date(task.completedAt) >= todayStart
    ).length;
  };

  const getTasksCompletedThisWeekCount = () => {
    const now = new Date();
    const today = now.getDay(); // 0 (Sun) - 6 (Sat)
    const weekStart = new Date(now);
    // Adjust to Monday as the start of the week
    weekStart.setDate(now.getDate() - (today === 0 ? 6 : today - 1));
    weekStart.setHours(0, 0, 0, 0);
    return Object.values(tasks).filter(
      (task: Task) => task.completed && task.completedAt && new Date(task.completedAt) >= weekStart
    ).length;
  };

  const getTasksCompletedThisMonthCount = () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    return Object.values(tasks).filter(
      (task: Task) => task.completed && task.completedAt && new Date(task.completedAt) >= monthStart
    ).length;
  };

  return (
    <div className="w-64 bg-slate-50 p-4 border-r h-full flex-shrink-0 shadow-sm"> {/* Slightly different bg and shadow */}
      <h2 className="text-lg font-semibold mb-5 text-slate-700 border-b pb-2">統計情報</h2> {/* Adjusted styles */}
      <div className="space-y-4 text-sm"> {/* Adjusted spacing and text size */}
        <div className="flex justify-between items-center">
          <span className="font-medium text-slate-600">総完了タスク数:</span>
          <span className="font-bold text-slate-800 text-base">{getCompletedTasksTotalCount()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-medium text-slate-600">今日完了したタスク:</span>
          <span className="font-bold text-slate-800 text-base">{getTasksCompletedTodayCount()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-medium text-slate-600">今週完了したタスク:</span>
          <span className="font-bold text-slate-800 text-base">{getTasksCompletedThisWeekCount()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-medium text-slate-600">今月完了したタスク:</span>
          <span className="font-bold text-slate-800 text-base">{getTasksCompletedThisMonthCount()}</span>
        </div>
        {/* Add more stats as needed */}
      </div>
    </div>
  );
};

export default StatsPanel;
