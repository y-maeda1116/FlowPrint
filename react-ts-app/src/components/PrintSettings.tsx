// src/components/PrintSettings.tsx
import React, { useState } from 'react';
import { printerService } from '../services/PrinterService';
import { generateReceipt, INIT_PRINTER, ALIGN_CENTER, createTextBlock, LF, CUT_PAPER_FULL } from '../utils/escpos';
import useTaskStore from '../store/useTaskStore';

interface PrintSettingsProps {
  columnIdToPrint?: string | null;
}

const PrintSettings: React.FC<PrintSettingsProps> = ({ columnIdToPrint }) => {
  const [isConnected, setIsConnected] = useState(printerService.isConnected());
  const [statusMessage, setStatusMessage] = useState('');
  const allTasks = useTaskStore(state => state.tasks); // Renamed to avoid conflict
  const columns = useTaskStore(state => state.columns);


  const handleConnect = async () => {
    setStatusMessage('プリンターに接続中...');
    const success = await printerService.connect();
    setIsConnected(success);
    setStatusMessage(success ? 'プリンターに接続しました。' : 'プリンターへの接続に失敗しました。USBデバイスのパーミッションを確認してください。');
  };

  const handleDisconnect = async () => {
    setStatusMessage('プリンターから切断中...');
    await printerService.disconnect();
    setIsConnected(false);
    setStatusMessage('プリンターから切断しました。');
  };

  const handleTestPrint = async () => {
    if (!isConnected) {
      setStatusMessage('プリンターが接続されていません。');
      return;
    }
    setStatusMessage('テスト印刷中...');

    const commands: Uint8Array[] = [];
    commands.push(INIT_PRINTER);
    commands.push(createTextBlock("FlowPrint Test Print", ALIGN_CENTER, true)); // Bold
    commands.push(createTextBlock("--------------------------------", ALIGN_CENTER));
    commands.push(createTextBlock("Standard Text (Left)", ALIGN_CENTER));
    commands.push(createTextBlock("こんにちは世界 (UTF-8 Test)", ALIGN_CENTER));
    commands.push(new Uint8Array([LF, LF]));
    commands.push(createTextBlock("Thank you!", ALIGN_CENTER, false, true)); // Underline
    commands.push(new Uint8Array([LF, LF, LF]));
    commands.push(CUT_PAPER_FULL);

    let totalLength = 0;
    commands.forEach(cmd => totalLength += cmd.length);
    const dataToPrint = new Uint8Array(totalLength);
    let offset = 0;
    commands.forEach(cmd => {
        dataToPrint.set(cmd, offset);
        offset += cmd.length;
    });

    const success = await printerService.printRaw(dataToPrint);
    setStatusMessage(success ? 'テスト印刷を送信しました。' : 'テスト印刷に失敗しました。');
  };

  const handlePrintColumn = async (targetColumnId: string) => {
    if (!isConnected) {
      setStatusMessage('プリンターが接続されていません。');
      return;
    }
    const columnToPrint = columns.find(col => col.id === targetColumnId);
    if (!columnToPrint) {
        setStatusMessage('印刷対象のカラムが見つかりません。');
        return;
    }

    const columnTasksToShow = columnToPrint.taskIds
        .map(tid => allTasks[tid])
        .filter(Boolean) // Filter out undefined tasks if any ID is invalid
        .map(task => ({ name: task.title, completed: task.completed }));

    if (columnTasksToShow.length === 0) {
        setStatusMessage('カラムに印刷するタスクがありません。');
        return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const parentTaskTitle = columnToPrint.parentTaskId ? allTasks[columnToPrint.parentTaskId]?.title : "ルートタスク";
    const headerText = `タスクリスト: ${parentTaskTitle || 'ルート'}`;

    setStatusMessage(`カラム「${headerText}」を印刷中...`);

    const receiptData = generateReceipt(
        headerText,
        dateStr,
        timeStr,
        columnTasksToShow,
        columnTasksToShow.length,
        "Printed by FlowPrint"
    );
    const success = await printerService.printRaw(receiptData);
    setStatusMessage(success ? 'カラム印刷を送信しました。' : 'カラム印刷に失敗しました。');
  }

  return (
    <div className="p-4 border-t bg-slate-100"> {/* Changed background color */}
      <h3 className="text-md font-semibold mb-3">プリンター連携</h3> {/* Changed text size */}
      <div className="flex items-center space-x-2 mb-2">
        {isConnected ? (
          <button onClick={handleDisconnect} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-sm">切断</button>
        ) : (
          <button onClick={handleConnect} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm">プリンター接続</button>
        )}
        <button onClick={handleTestPrint} disabled={!isConnected} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm disabled:bg-gray-400 disabled:cursor-not-allowed">テスト印刷</button>
        {columnIdToPrint && ( // Only show if a column context is provided
           <button
             onClick={() => handlePrintColumn(columnIdToPrint)}
             disabled={!isConnected}
             className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
           >
             選択中カラム印刷
           </button>
        )}
      </div>
      {statusMessage && <p className="mt-1 text-xs text-gray-700">{statusMessage}</p>}
    </div>
  );
};

export default PrintSettings;
