// src/components/TaskModal.tsx
import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Task } from '../types';
import useTaskStore, { TaskTemplate } from '../store/useTaskStore';
import { v4 as uuidv4 } from 'uuid';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  parentId?: string | null;
}

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, taskToEdit, parentId }) => {
  const addTask = useTaskStore((state) => state.addTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const taskTemplates = useTaskStore(state => state.taskTemplates);
  const applyTemplate = useTaskStore(state => state.applyTemplate);
  const setSelectedTaskId = useTaskStore(state => state.setSelectedTaskId); // For selecting new task
  const setEditingTaskId = useTaskStore(state => state.setEditingTaskId); // For editing new task

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | undefined>(undefined);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const [totalSplitTime, setTotalSplitTime] = useState<number | undefined>(undefined);
  const [splitUnitTime, setSplitUnitTime] = useState<number | undefined>(30);

  const [selectedTemplate, setSelectedTemplate] = useState<string>('');


  useEffect(() => {
    if (isOpen) { // Only reset/populate when modal becomes visible or taskToEdit changes
        if (taskToEdit) {
          setTitle(taskToEdit.title);
          setDescription(taskToEdit.description || '');
          setEstimatedMinutes(taskToEdit.estimatedMinutes);
          setPriority(taskToEdit.priority);
          // Editing existing task, so disable/hide splitting and template options
          setTotalSplitTime(undefined);
          setSelectedTemplate('');
        } else {
          // Reset for new task
          setTitle('');
          setDescription('');
          setEstimatedMinutes(undefined);
          setPriority('medium');
          setTotalSplitTime(undefined);
          setSplitUnitTime(30);
          setSelectedTemplate('');
        }
    }
  }, [taskToEdit, isOpen]);

  const handleTimeSplit = () => {
    const baseTitle = title.trim() || "分割タスク"; // Use default if title is empty for split
    if (!totalSplitTime || !splitUnitTime || totalSplitTime <= 0 || splitUnitTime <= 0) {
        alert('総時間と分割単位を正しく入力してください。');
        return;
    }

    const numberOfTasks = Math.ceil(totalSplitTime / splitUnitTime);
    // const actualUnitTime = totalSplitTime / numberOfTasks; // Equally distribute is complex with rounding, stick to splitUnitTime
    const createdTaskIds: string[] = [];

    for (let i = 0; i < numberOfTasks; i++) {
        const taskTitle = `${baseTitle} (${i + 1}/${numberOfTasks})`;
        // For the last task, adjust its estimated time to make the total match totalSplitTime
        const currentTaskEstMinutes = (i === numberOfTasks - 1)
            ? (totalSplitTime - (splitUnitTime * i))
            : splitUnitTime;

        const newTask: Task = {
            id: uuidv4(),
            title: taskTitle,
            description: description.trim() || undefined, // Carry over description
            completed: false,
            parentId: parentId !== undefined ? parentId : null,
            childrenIds: [],
            createdAt: new Date(new Date().getTime() + i * (splitUnitTime * 60000)), // Offset start time slightly
            completedAt: null,
            estimatedMinutes: Math.max(1, Math.round(currentTaskEstMinutes)), // Ensure at least 1 minute
            priority, // Carry over priority
            tags: [], // Carry over tags if any (not implemented yet)
        };
        addTask(newTask);
        createdTaskIds.push(newTask.id);
    }
    if (createdTaskIds.length > 0) {
        setSelectedTaskId(createdTaskIds[0]); // Select the first created task
    }
    onClose();
  }

  const handleApplyTemplate = () => {
    if (!selectedTemplate || !taskTemplates[selectedTemplate]) {
        alert('適用するテンプレートを選択してください。');
        return;
    }
    const newIds = applyTemplate(selectedTemplate, parentId !== undefined ? parentId : null, new Date());
    if (newIds.length > 0) {
        setSelectedTaskId(newIds[0]); // Select the first top-level task from the template
        // Optionally, open the first task for editing, or navigate to its column
        // setEditingTaskId(newIds[0]);
    }
    onClose();
  }


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (taskToEdit) { // Editing existing task
      if (!title.trim()) {
        alert('タスクタイトルは必須です。');
        return;
      }
      updateTask(taskToEdit.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          estimatedMinutes,
          priority
      });
    } else { // Creating new task(s)
      if (selectedTemplate && taskTemplates[selectedTemplate]) {
          handleApplyTemplate(); // This will also close the modal
          return; // Important: stop further execution in handleSubmit
      } else if (totalSplitTime && splitUnitTime && totalSplitTime > 0 && splitUnitTime > 0) {
          handleTimeSplit(); // This will also close the modal
          return; // Important: stop further execution in handleSubmit
      } else { // Simple new task
        if (!title.trim()) {
          alert('タスクタイトルは必須です。');
          return;
        }
        const newTask: Task = {
          id: uuidv4(),
          title: title.trim(),
          description: description.trim() || undefined,
          completed: false,
          parentId: parentId !== undefined ? parentId : null,
          childrenIds: [],
          createdAt: new Date(),
          completedAt: null,
          estimatedMinutes,
          priority,
          tags: [],
        };
        addTask(newTask);
        setSelectedTaskId(newTask.id); // Select the newly created task
        // setEditingTaskId(newTask.id); // Optionally open for editing
      }
    }
    onClose(); // Close modal for simple add or edit
  };

  const isCreatingFromTemplate = !taskToEdit && !!selectedTemplate && !(totalSplitTime && totalSplitTime > 0) ;
  const isCreatingFromSplit = !taskToEdit && !!totalSplitTime && !!splitUnitTime && totalSplitTime > 0 && splitUnitTime > 0;


  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-30" onClose={onClose}> {/* Increased z-index */}
        <Transition.Child
          as="div" // Changed from Fragment to "div"
          className="fixed inset-0 bg-black bg-opacity-40" // Moved className here
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        /> {/* Self-closing */}

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Dialog.Panel} // Changed from Fragment to Dialog.Panel
              className="w-full max-w-lg transform overflow-hidden rounded-xl bg-white p-6 text-left align-middle shadow-2xl transition-all" // Moved Dialog.Panel props here
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              {/* Dialog.Panel's children are now Transition.Child's children */}
              <Dialog.Title as="h3" className="text-xl font-semibold leading-7 text-gray-900 mb-4"> {/* Increased font size, margin */}
                {taskToEdit ? 'タスク編集' : '新規タスク作成'}
              </Dialog.Title>
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4"> {/* Added space-y for better spacing */}
                    <div>
                      <label htmlFor="title" className="block text-sm font-medium text-gray-800">タイトル*</label> {/* Adjusted color */}
                      <input type="text" name="title" id="title" value={title} onChange={(e) => setTitle(e.target.value)}
                             disabled={isCreatingFromTemplate} // Disable if creating from template
                             className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-600 focus:ring-indigo-600 sm:text-sm p-2 border" />
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-800">詳細 (オプション)</label>
                      <textarea name="description" id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                                disabled={isCreatingFromTemplate}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-600 focus:ring-indigo-600 sm:text-sm p-2 border" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="estimatedMinutes" className="block text-sm font-medium text-gray-800">予定時間 (分)</label>
                            <input type="number" name="estimatedMinutes" id="estimatedMinutes" value={estimatedMinutes || ''}
                                   onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || undefined)}
                                   disabled={isCreatingFromTemplate || isCreatingFromSplit}
                                   className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-600 focus:ring-indigo-600 sm:text-sm p-2 border" />
                        </div>
                        <div>
                            <label htmlFor="priority" className="block text-sm font-medium text-gray-800">優先度</label>
                            <select id="priority" name="priority" value={priority}
                                    onChange={(e) => setPriority(e.target.value as 'low'|'medium'|'high')}
                                    disabled={isCreatingFromTemplate}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-600 focus:ring-indigo-600 sm:text-sm p-2 border bg-white">
                                <option value="low">低</option>
                                <option value="medium">中</option>
                                <option value="high">高</option>
                            </select>
                        </div>
                    </div>
                  </div>

                  {!taskToEdit && (
                    <>
                      <fieldset className="mt-6 border-t pt-5"> {/* Increased margin, padding */}
                        <legend className="text-md font-semibold text-gray-900 mb-2">時間ベースで分割 (オプション)</legend> {/* Increased font size, margin */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="totalSplitTime" className="block text-sm font-medium text-gray-800">総時間 (分)</label>
                            <input type="number" name="totalSplitTime" id="totalSplitTime" value={totalSplitTime || ''}
                                   onChange={(e) => { setTotalSplitTime(parseInt(e.target.value) || undefined); setSelectedTemplate('');}} // Clear template if split is used
                                   className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                          </div>
                          <div>
                            <label htmlFor="splitUnitTime" className="block text-sm font-medium text-gray-800">分割単位 (分)</label>
                            <input type="number" name="splitUnitTime" id="splitUnitTime" value={splitUnitTime || ''}
                                   onChange={(e) => setSplitUnitTime(parseInt(e.target.value) || undefined)}
                                   className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                          </div>
                        </div>
                      </fieldset>

                      <fieldset className="mt-6 border-t pt-5">
                        <legend className="text-md font-semibold text-gray-900 mb-2">テンプレートから作成 (オプション)</legend>
                        <div className="mt-2">
                          <select name="template" id="template" value={selectedTemplate}
                                  onChange={(e) => { setSelectedTemplate(e.target.value); setTotalSplitTime(undefined); }} // Clear split if template is used
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border bg-white focus:border-indigo-600 focus:ring-indigo-600">
                            <option value="">テンプレートを選択...</option>
                            {Object.values(taskTemplates).map(template => (
                              <option key={template.id} value={template.id}>{template.name}</option>
                            ))}
                          </select>
                        </div>
                      </fieldset>
                    </>
                  )}

                  <div className="mt-6 flex justify-end space-x-3"> {/* Increased margin, spacing */}
                    <button type="button" onClick={onClose}
                            className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
                      キャンセル
                    </button>
                    <button type="submit"
                            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
                      {taskToEdit ? '更新' : (isCreatingFromTemplate ? 'テンプレートから作成' : (isCreatingFromSplit ? '分割して作成' : '作成'))}
                    </button>
                  </div>
                </form>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default TaskModal;
