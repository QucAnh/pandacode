import type { Session } from './types';
import { escape } from './dom';

/** The agent's plan for one task: decoration the user follows while it works. */
export type TodoItem = { text: string; status: 'pending' | 'active' | 'done' };

const STATUSES = new Set(['pending', 'active', 'done']);
const MAX_ITEMS = 40;
const MAX_TEXT = 200;
/** Five steps on screen, the active one in the middle. */
const WINDOW = 5;
const MIDDLE = 2;

function items(task: Session): TodoItem[] {
  return (Array.isArray(task.todos) ? task.todos : [])
    .slice(0, MAX_ITEMS)
    .filter(item => item && typeof item.text === 'string' && item.text.trim())
    .map(item => ({ text: [...item.text.trim()].slice(0, MAX_TEXT).join(''), status: STATUSES.has(item.status) ? item.status : 'pending' }) as TodoItem);
}

// A window keeps its place while the active step moves inside it, so nothing shifts under the eye.
const windows = new Map<string, { start: number; count: number }>();

/** The five steps drawn on a card, centred on the active one; hidden counts go above and below. */
export function visibleItems(list: TodoItem[], key = ''): { shown: TodoItem[]; before: number; after: number } {
  const active = list.findIndex(item => item.status === 'active');
  const last = Math.max(0, list.length - WINDOW);
  const centred = Math.max(0, Math.min(active < 0 ? 0 : active - MIDDLE, last));
  const saved = windows.get(key);
  const start = saved && saved.count === list.length && active >= saved.start && active < saved.start + WINDOW ? saved.start : centred;
  if (key) windows.set(key, { start, count: list.length });
  const shown = list.slice(start, start + WINDOW);
  return { shown, before: start, after: list.length - start - shown.length };
}

function card(task: Session, running: boolean, attention: boolean): string {
  const list = items(task);
  const done = list.filter(item => item.status === 'done').length;
  const { shown, before, after } = visibleItems(list, task.id);
  const share = list.length ? Math.round((done / list.length) * 100) : 0;
  const lines = shown.map(item => `<li class="todo-item ${item.status}" title="${escape(item.text)}"><span class="todo-mark" aria-hidden="true"></span><span class="todo-text">${escape(item.text)}</span></li>`).join('');
  const earlier = before ? `<li class="todo-more before"><span>+${before} finished</span></li>` : '';
  const later = after ? `<li class="todo-more after"><span>+${after} more</span></li>` : '';
  return `<section class="todo-card${running ? ' running' : ''}${attention ? ' attention' : ''}" data-todo-task="${escape(task.id)}" aria-label="Plan: ${escape(task.title)}">
    <div class="todo-head"><span class="todo-title">${escape(task.title)}</span><span class="todo-count">${done}/${list.length}</span></div>
    <div class="todo-track" aria-hidden="true"><span style="width:${share}%"></span></div>
    <ul class="todo-items">${earlier}${lines}${later}</ul>
  </section>`;
}

/** Every task in the open project with a plan, in sidebar order. */
export function plannedTasks(tasks: Session[], projectId: string | null | undefined): Session[] {
  if (!projectId) return [];
  return tasks.filter(task => task.projectId === projectId && !task.draft && !task.archived && items(task).length);
}

/** The cards for those tasks; nothing when none has a plan. */
export function todoCardsHtml(tasks: Session[], projectId: string | null | undefined, running: (id: string) => boolean, attention: (id: string) => boolean = () => false): string {
  const drawn = plannedTasks(tasks, projectId);
  for (const id of windows.keys()) if (!drawn.some(task => task.id === id)) windows.delete(id);
  return drawn.map(task => card(task, running(task.id), attention(task.id))).join('');
}

