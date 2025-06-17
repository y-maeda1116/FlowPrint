// src/store/useTaskStore.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import useTaskStore from './useTaskStore';
import { Task } from '../types';
import { v4 as uuidv4 } from 'uuid';

// persistミドルウェアがlocalStorageを使用するため、各テスト後にクリア
beforeEach(() => {
  localStorage.clear(); // Clear any persisted state
  // ストアを定義済みの初期状態にリセット (persistミドルウェアによる再hydrationを防ぐため、これが重要)
  // useTaskStore.persist.clearStorage() is not a standard API, so manual reset or specific mock is needed.
  // The most reliable way for tests is to reset the store to a known initial state.
  // We fetch the initial state definition from the store module itself if possible,
  // or redefine it here for test purposes.
  // For this test, we will use the actual initial state logic from the store if it's simple,
  // otherwise, we define a clean minimal state.

  // Resetting the store to its initial state as defined within the store itself.
  // This involves calling setState with the initial parts of the state.
  // The actual initial state from the store includes sample data, which might be okay for some tests,
  // but for isolated unit tests, a truly empty state is better.
  const defaultTestState = {
    tasks: {},
    rootTaskIds: [],
    columns: [{id: 'test-root-col', taskIds: [], parentTaskId: null, level: 0}], // Minimal column for root tasks
    taskTemplates: {},
    selectedTaskId: null,
    editingTaskId: null,
    // Selectors are methods, not state properties to reset here
  };
  useTaskStore.setState(defaultTestState, true); // true replaces the anystate
});

afterEach(() => {
    vi.useRealTimers(); // Reset timers after each test if fake timers were used
});

describe('useTaskStore actions', () => {
  describe('addTask', () => {
    it('should add a new root task correctly', () => {
      const taskId = uuidv4();
      const newTask: Task = {
        id: taskId, title: 'Test Root Task', completed: false, parentId: null, childrenIds: [],
        createdAt: new Date(), completedAt: null, priority: 'medium', tags: []
      };
      useTaskStore.getState().addTask(newTask);

      const state = useTaskStore.getState();
      expect(state.tasks[taskId]).toEqual(expect.objectContaining(newTask));
      expect(state.rootTaskIds).toContain(taskId);
      // Check if the task was added to the default root column provided in beforeEach
      const rootColumn = state.columns.find(col => col.parentTaskId === null);
      expect(rootColumn?.taskIds).toContain(taskId);
    });

    it('should add a new sub task correctly', () => {
      const parentId = uuidv4();
      const parentTask: Task = {
        id: parentId, title: 'Parent Task', completed: false, parentId: null, childrenIds: [],
        createdAt: new Date(), completedAt: null, priority: 'medium', tags: []
      };
      useTaskStore.getState().addTask(parentTask); // Add parent first

      const childId = uuidv4();
      const childTask: Task = {
        id: childId, title: 'Child Task', completed: false, parentId: parentId, childrenIds: [],
        createdAt: new Date(), completedAt: null, priority: 'medium', tags: []
      };
      useTaskStore.getState().addTask(childTask);

      const state = useTaskStore.getState();
      expect(state.tasks[childId]).toEqual(expect.objectContaining(childTask));
      expect(state.tasks[parentId]?.childrenIds).toContain(childId);
      expect(state.rootTaskIds).not.toContain(childId); // Child task should not be in rootTaskIds
    });
  });

  describe('deleteTask', () => {
    let rootTaskId: string;
    let parentId: string;
    let childId: string;

    beforeEach(() => {
      // Create a root task
      rootTaskId = uuidv4();
      const rootTask: Task = {
        id: rootTaskId, title: 'Root Task for Deletion Test', completed: false, parentId: null, childrenIds: [],
        createdAt: new Date(), completedAt: null, priority: 'medium', tags: []
      };
      useTaskStore.getState().addTask(rootTask);

      // Create a parent task (also a root task for simplicity in this direct setup)
      parentId = uuidv4();
      const parentT: Task = {
        id: parentId, title: 'Parent Task for Child Deletion', completed: false, parentId: null, childrenIds: [],
        createdAt: new Date(), completedAt: null, priority: 'medium', tags: []
      };
      useTaskStore.getState().addTask(parentT);

      // Create a child task
      childId = uuidv4();
      const childT: Task = {
        id: childId, title: 'Child Task to Delete', completed: false, parentId: parentId, childrenIds: [],
        createdAt: new Date(), completedAt: null, priority: 'medium', tags: []
      };
      useTaskStore.getState().addTask(childT); // This will also update parent's childrenIds
    });

    it('should delete a root task correctly', () => {
      useTaskStore.getState().deleteTask(rootTaskId);
      const state = useTaskStore.getState();
      expect(state.tasks[rootTaskId]).toBeUndefined();
      expect(state.rootTaskIds).not.toContain(rootTaskId);
      state.columns.forEach(col => {
        expect(col.taskIds).not.toContain(rootTaskId);
      });
    });

    it('should delete a child task and update parent and columns', () => {
      // Pre-check
      expect(useTaskStore.getState().tasks[childId]).toBeDefined();
      expect(useTaskStore.getState().tasks[parentId]?.childrenIds).toContain(childId);

      useTaskStore.getState().deleteTask(childId);

      const state = useTaskStore.getState();
      expect(state.tasks[childId]).toBeUndefined();
      expect(state.tasks[parentId]?.childrenIds).not.toContain(childId);
      state.columns.forEach(col => { // Assuming child tasks might be in columns
        expect(col.taskIds).not.toContain(childId);
      });
    });

    it('should reset selectedTaskId and editingTaskId if the deleted task was selected/editing', () => {
      useTaskStore.setState({ selectedTaskId: childId, editingTaskId: childId });
      useTaskStore.getState().deleteTask(childId);
      const state = useTaskStore.getState();
      expect(state.selectedTaskId).toBeNull();
      expect(state.editingTaskId).toBeNull();
    });
  });

  describe('toggleTaskCompletion', () => {
    let taskId: string;
    const fixedDate = new Date('2023-10-26T12:00:00.000Z');

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(fixedDate);

      taskId = uuidv4();
      const task: Task = {
        id: taskId, title: 'Task to Toggle', completed: false, parentId: null, childrenIds: [],
        createdAt: new Date('2023-10-26T10:00:00.000Z'), completedAt: null, priority: 'medium', tags: []
      };
      useTaskStore.getState().addTask(task);
    });

    it('should toggle task completion status and set completedAt', () => {
      useTaskStore.getState().toggleTaskCompletion(taskId);
      let taskState = useTaskStore.getState().tasks[taskId];
      expect(taskState.completed).toBe(true);
      expect(taskState.completedAt).toEqual(fixedDate);

      useTaskStore.getState().toggleTaskCompletion(taskId);
      taskState = useTaskStore.getState().tasks[taskId];
      expect(taskState.completed).toBe(false);
      expect(taskState.completedAt).toBeNull();
    });
  });
});
