// src/components/DataManagementPanel.tsx
import React, { useRef } from 'react';
import useTaskStore from '../store/useTaskStore';
import { ExportedData, ExportedTask, Task, TaskTemplate } from '../types'; // TaskTemplateもインポート

const CURRENT_DATA_VERSION = 1;

const DataManagementPanel: React.FC = () => {
  const tasks = useTaskStore(state => state.tasks);
  const rootTaskIds = useTaskStore(state => state.rootTaskIds);
  const taskTemplates = useTaskStore(state => state.taskTemplates);
  const importState = useTaskStore(state => state.importState);
  const setActiveColumns = useTaskStore(state => state.setActiveColumns);


  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const exportedTasks: Record<string, ExportedTask> = Object.fromEntries(
      Object.entries(tasks).map(([id, task]) => [
        id,
        {
          ...task,
          createdAt: task.createdAt.toISOString(),
          completedAt: task.completedAt ? task.completedAt.toISOString() : null,
        },
      ])
    );

    // Assuming TaskTemplate does not contain Date objects that need conversion for export
    const dataToExport: ExportedData = {
      version: CURRENT_DATA_VERSION,
      tasks: exportedTasks,
      rootTaskIds,
      taskTemplates,
    };

    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    a.download = `flowprint_backup_${timestamp}.json`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('データをエクスポートしました。');
  };

  const handleImportChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result;
        if (typeof json !== 'string') {
          throw new Error('ファイルの内容が不正です。');
        }
        const parsedData = JSON.parse(json) as ExportedData;

        if (parsedData.version !== CURRENT_DATA_VERSION) {
            const proceed = window.confirm(
                `データバージョンが異なります (ファイル: ${parsedData.version || '不明'}, アプリ: ${CURRENT_DATA_VERSION})。\n` +
                `互換性がない可能性があり、問題が発生するかもしれません。\n` +
                `それでもインポートを続行しますか？`
            );
            if (!proceed) {
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
        }
        if (!parsedData.tasks || typeof parsedData.tasks !== 'object' ||
            !parsedData.rootTaskIds || !Array.isArray(parsedData.rootTaskIds) ||
            !parsedData.taskTemplates || typeof parsedData.taskTemplates !== 'object') {
            throw new Error('インポートファイルに必要なデータキー (tasks, rootTaskIds, taskTemplates) が含まれていません。');
        }

        const success = importState(parsedData);
        if (success) {
          alert('データをインポートしました。カラム表示を更新します。');
          setActiveColumns([]); // インポート後、カラム表示をリセット/更新
        } else {
          alert('データのインポートに失敗しました。コンソールログを確認してください。');
        }

      } catch (error) {
        console.error("Import failed:", error);
        alert(`インポートエラー: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.onerror = () => {
        alert('ファイルの読み込みに失敗しました。');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
    reader.readAsText(file);
  };

  return (
    <div className="p-4 border-t bg-slate-100"> {/* Matches PrintSettings style */}
      <h3 className="text-md font-semibold mb-3 text-slate-700">データ管理</h3>
      <div className="space-y-2 sm:space-y-0 sm:flex sm:space-x-2">
        <button
          onClick={handleExport}
          className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white font-medium py-1.5 px-3 rounded text-sm" // Adjusted style
        >
          JSONエクスポート
        </button>
        <input
          type="file"
          accept=".json,application/json" // More specific accept types
          onChange={handleImportChange}
          ref={fileInputRef}
          className="hidden"
          id="jsonImportInput"
        />
        <label
            htmlFor="jsonImportInput"
            className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-medium py-1.5 px-3 rounded text-sm cursor-pointer inline-block text-center" // Adjusted style
        >
          JSONインポート
        </label>
      </div>
    </div>
  );
};

export default DataManagementPanel;
