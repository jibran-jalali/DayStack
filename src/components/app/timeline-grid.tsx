import { useMemo } from "react";
import { CalendarRange, CheckCircle2, Plus, Users, Video } from "lucide-react";

import { Button } from "@/components/shared/button";
import {
  formatClockTime,
  formatDateKey,
  formatParticipantNames,
  getTaskAnchorId,
  getTimelineTaskLayouts,
  toMinutes,
} from "@/lib/daystack";
import { cn } from "@/lib/utils";
import type { PlannerTask, TaskVisualState } from "@/types/daystack";

interface TimelineGridProps {
  focusedTaskId?: string | null;
  isPending: boolean;
  now: Date;
  onAddTask: (startTime?: string) => void;
  onEditTask: (task: PlannerTask) => void;
  onToggleTask: (task: PlannerTask) => void;
  resolveVisualState: (task: PlannerTask) => TaskVisualState;
  taskDate: string;
  tasks: PlannerTask[];
}

const SLOT_HEIGHT = 40;
const DEFAULT_START_MINUTES = 6 * 60;
const DEFAULT_END_MINUTES = 22 * 60;
const OVERLAP_GAP = 6;

const blockStyles: Record<TaskVisualState, string> = {
  active: "border-cyan-200 bg-cyan-50/95 shadow-[0_18px_32px_rgba(24,190,239,0.14)]",
  completed: "border-emerald-200/90 bg-emerald-50/78 shadow-[0_12px_24px_rgba(34,197,94,0.08)]",
  upcoming: "border-indigo-200 bg-indigo-50/85 shadow-[0_14px_26px_rgba(99,102,241,0.08)]",
  pending: "border-border/80 bg-white/98 shadow-[0_14px_28px_rgba(15,23,42,0.06)]",
  overdue: "border-rose-200 bg-rose-50/88 shadow-[0_14px_24px_rgba(244,63,94,0.08)]",
};

const blockTextStyles: Record<TaskVisualState, string> = {
  active: "text-sky-800",
  completed: "text-emerald-900/80",
  upcoming: "text-indigo-800",
  pending: "text-foreground",
  overdue: "text-rose-800",
};

const accentStyles: Record<TaskVisualState, string> = {
  active: "bg-primary",
  completed: "bg-emerald-400/70",
  upcoming: "bg-indigo-400",
  pending: "bg-slate-300",
  overdue: "bg-rose-400",
};

const stateLabels: Record<TaskVisualState, string> = {
  active: "Active",
  completed: "Done",
  upcoming: "Next",
  pending: "Pending",
  overdue: "Overdue",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;
}

function formatTimelineLabel(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const displayHours = hours % 12 || 12;
  const suffix = hours >= 12 ? "PM" : "AM";

  return minutes === 0 ? `${displayHours} ${suffix}` : `${displayHours}:30`;
}

function getTimelineBounds(tasks: PlannerTask[], now: Date, taskDate: string) {
  const todayMatches = formatDateKey(now) === taskDate;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const taskStarts = tasks.map((task) => toMinutes(task.start_time));
  const taskEnds = tasks.map((task) => toMinutes(task.end_time));

  const startCandidates = [DEFAULT_START_MINUTES];
  const endCandidates = [DEFAULT_END_MINUTES];

  if (taskStarts.length > 0) {
    startCandidates.push(Math.min(...taskStarts) - 60);
  }

  if (taskEnds.length > 0) {
    endCandidates.push(Math.max(...taskEnds) + 30);
  }

  if (todayMatches) {
    startCandidates.push(currentMinutes - 60);
    endCandidates.push(currentMinutes + 90);
  }

  return {
    startMinutes: clamp(Math.min(...startCandidates), 0, 23 * 60),
    endMinutes: clamp(Math.max(...endCandidates), DEFAULT_START_MINUTES + 60, 24 * 60),
  };
}

function getSlots(startMinutes: number, endMinutes: number) {
  const slots: number[] = [];

  for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
    slots.push(minutes);
  }

  return slots;
}

function getLayoutStyles(column: number, columns: number) {
  const totalGap = (columns - 1) * OVERLAP_GAP;
  const width = columns === 1 ? "100%" : `calc((100% - ${totalGap}px) / ${columns})`;
  const left =
    column === 0
      ? "0%"
      : `calc(${column} * ((100% - ${totalGap}px) / ${columns} + ${OVERLAP_GAP}px))`;

  return { left, width };
}

export function TimelineGrid({
  focusedTaskId,
  isPending,
  now,
  onAddTask,
  onEditTask,
  onToggleTask,
  resolveVisualState,
  taskDate,
  tasks,
}: TimelineGridProps) {
  const { startMinutes, endMinutes } = useMemo(() => getTimelineBounds(tasks, now, taskDate), [now, taskDate, tasks]);
  const slots = useMemo(() => getSlots(startMinutes, endMinutes), [endMinutes, startMinutes]);
  const layouts = useMemo(() => getTimelineTaskLayouts(tasks), [tasks]);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const showCurrentLine = formatDateKey(now) === taskDate && currentMinutes >= startMinutes && currentMinutes <= endMinutes;

  return (
    <div className="grid grid-cols-[3.9rem_minmax(0,1fr)] gap-3 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
      <div className="pt-1">
        {slots.map((slot) => (
          <div
            key={slot}
            className="flex h-[40px] items-start justify-end pr-2 pt-0.5 text-[11px] font-medium tabular-nums text-secondary-foreground sm:pr-3 sm:text-xs"
          >
            {formatTimelineLabel(slot)}
          </div>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-[24px] border border-border/80 bg-white/97">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(24,190,239,0.05),transparent)]" />

        {tasks.length === 0 ? (
          <div className="pointer-events-none absolute left-4 right-4 top-4 z-20 rounded-full border border-dashed border-border/90 bg-white/94 px-4 py-2 text-sm text-secondary-foreground shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            Your day is open. Tap a slot to place the first block.
          </div>
        ) : null}

        <div className="relative">
          {slots.map((slot, index) => (
            <button
              key={slot}
              suppressHydrationWarning
              type="button"
              className={cn(
                "group relative block h-[40px] w-full border-t border-border/60 text-left transition-[background-color,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-cyan-50/32 focus:bg-cyan-50/32 focus:outline-none",
                index === 0 && "border-t-0",
              )}
              onClick={() => onAddTask(minutesToTime(slot))}
              aria-label={`Add task at ${formatClockTime(minutesToTime(slot))}`}
            >
              <span className="pointer-events-none absolute inset-y-0 right-4 hidden items-center gap-2 text-[11px] font-semibold text-secondary-foreground/0 transition-[color,opacity] duration-150 sm:flex sm:group-hover:text-secondary-foreground/65 sm:group-focus-visible:text-secondary-foreground/65">
                <Plus className="h-3.5 w-3.5" />
                Add
              </span>
            </button>
          ))}

          {showCurrentLine ? (
            <div
              className="pointer-events-none absolute inset-x-3 z-20"
              style={{ top: `${((currentMinutes - startMinutes) / 30) * SLOT_HEIGHT}px` }}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_6px_rgba(20,150,232,0.14)]" />
                <div className="h-px flex-1 bg-primary/60" />
              </div>
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-y-0 left-3 right-3 top-0">
            {layouts.map((layout) => {
              const task = layout.task;
              const visualState = resolveVisualState(task);
              const startOffset = ((layout.startMinutes - startMinutes) / 30) * SLOT_HEIGHT;
              const blockHeight = Math.max(((layout.endMinutes - layout.startMinutes) / 30) * SLOT_HEIGHT - 8, 42);
              const isCompact = blockHeight < 74 || layout.columns > 2;
              const isTight = blockHeight < 90 || layout.columns > 1;
              const isMeeting = task.task_type === "meeting";
              const { left, width } = getLayoutStyles(layout.column, layout.columns);

              return (
                <div
                  key={task.id}
                  id={getTaskAnchorId(task.id)}
                  className={cn(
                    "pointer-events-auto absolute z-10 overflow-hidden rounded-[20px] border transition-[transform,box-shadow,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    blockStyles[visualState],
                    focusedTaskId === task.id && "ring-2 ring-primary/35 ring-offset-2 ring-offset-background",
                  )}
                  style={{
                    top: `${startOffset + 4}px`,
                    height: `${blockHeight}px`,
                    left,
                    width,
                  }}
                >
                  <div
                    suppressHydrationWarning
                    role="button"
                    tabIndex={0}
                    className="relative h-full cursor-pointer px-3 py-3 pr-12 text-left transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.002] focus:outline-none"
                    onClick={() => onEditTask(task)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onEditTask(task);
                      }
                    }}
                  >
                    <span className={cn("absolute inset-y-3 left-2 w-1 rounded-full", accentStyles[visualState])} />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 pl-2">
                        <div className="flex min-w-0 items-center gap-2">
                          {isMeeting ? (
                            <Video className="h-3.5 w-3.5 shrink-0 text-primary" />
                          ) : (
                            <CalendarRange className="h-3.5 w-3.5 shrink-0 text-secondary-foreground" />
                          )}
                          <p className={cn("truncate text-sm font-semibold", blockTextStyles[visualState])}>{task.title}</p>
                        </div>
                        {!isCompact ? (
                          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-secondary-foreground">
                            {formatClockTime(task.start_time)} to {formatClockTime(task.end_time)}
                          </p>
                        ) : null}
                        {isMeeting && task.participants.length > 0 && !isTight ? (
                          <p className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate text-[11px] text-secondary-foreground">
                            <Users className="h-3.5 w-3.5 shrink-0" />
                            {formatParticipantNames(task.participants, layout.columns > 1 ? 1 : 2)}
                          </p>
                        ) : null}
                      </div>
                      {!isCompact ? (
                        <span className="rounded-full border border-white/70 bg-white/82 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-secondary-foreground">
                          {stateLabels[visualState]}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={task.status === "completed" ? "secondary" : "ghost"}
                    className="absolute right-2 top-2 h-8 w-8 rounded-full border border-white/70 bg-white/84 px-0 text-secondary-foreground shadow-[0_8px_18px_rgba(15,23,42,0.05)] hover:bg-white"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleTask(task);
                    }}
                    disabled={isPending}
                    aria-label={task.status === "completed" ? `Mark ${task.title} pending` : `Mark ${task.title} complete`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
