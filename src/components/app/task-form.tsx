"use client";

import { useState } from "react";
import { CalendarRange, Link2, Trash2, Users, Video } from "lucide-react";

import { ParticipantPicker } from "@/components/app/participant-picker";
import { Button } from "@/components/shared/button";
import { Input } from "@/components/shared/input";
import { addMinutesToTime, formatDateLabel } from "@/lib/daystack";
import { taskFormSchema, type TaskFormValues } from "@/types/daystack";

interface TaskFormProps {
  currentUserId: string;
  mode: "create" | "edit";
  initialValues: TaskFormValues;
  isPending: boolean;
  onCancel: () => void;
  onDelete?: () => void;
  onSubmit: (values: TaskFormValues) => Promise<void> | void;
}

export function TaskForm({
  currentUserId,
  mode,
  initialValues,
  isPending,
  onCancel,
  onDelete,
  onSubmit,
}: TaskFormProps) {
  const [values, setValues] = useState<TaskFormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEndTimeDirty, setIsEndTimeDirty] = useState(mode === "edit");

  function setField(name: keyof TaskFormValues, value: string) {
    setValues((current) => {
      if (name === "startTime") {
        return {
          ...current,
          startTime: value,
          endTime: isEndTimeDirty ? current.endTime : addMinutesToTime(value),
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });

    if (name === "endTime") {
      setIsEndTimeDirty(true);
    }

    setErrors((current) => ({
      ...current,
      [name]: "",
    }));
  }

  function setTaskType(taskType: TaskFormValues["taskType"]) {
    setValues((current) => ({
      ...current,
      taskType,
      meetingLink: taskType === "meeting" ? current.meetingLink : "",
      participants: taskType === "meeting" ? current.participants : [],
    }));
    setErrors((current) => ({
      ...current,
      taskType: "",
      meetingLink: "",
      participants: "",
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = taskFormSchema.safeParse(values);

    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      setErrors({
        title: flattened.title?.[0] ?? "",
        startTime: flattened.startTime?.[0] ?? "",
        endTime: flattened.endTime?.[0] ?? "",
        taskDate: flattened.taskDate?.[0] ?? "",
        taskType: flattened.taskType?.[0] ?? "",
        meetingLink: flattened.meetingLink?.[0] ?? "",
        participants: flattened.participants?.[0] ?? "",
      });
      return;
    }

    await onSubmit(parsed.data);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="rounded-[20px] border border-border/80 bg-muted/45 px-4 py-3 text-sm text-secondary-foreground">
        Planning for <span className="font-semibold text-foreground">{formatDateLabel(values.taskDate)}</span>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium text-foreground">Type</span>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              value: "generic",
              label: "Generic",
              icon: CalendarRange,
            },
            {
              value: "meeting",
              label: "Meeting",
              icon: Video,
            },
          ].map((option) => {
            const Icon = option.icon;
            const isActive = values.taskType === option.value;

            return (
              <button
                key={option.value}
                suppressHydrationWarning
                type="button"
                className={`flex items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition-[transform,box-shadow,border-color,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isActive
                    ? "border-primary/25 bg-cyan-50/72 shadow-[0_12px_24px_rgba(24,190,239,0.1)]"
                    : "border-border/80 bg-white/92 hover:border-primary/20 hover:bg-white"
                }`}
                onClick={() => setTaskType(option.value as TaskFormValues["taskType"])}
                disabled={isPending}
              >
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                    isActive ? "bg-brand-gradient text-white" : "bg-muted text-secondary-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                  <span className="block text-xs text-secondary-foreground">
                    {option.value === "generic" ? "Flexible task block" : "Link and participants"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {errors.taskType ? <p className="text-sm text-danger">{errors.taskType}</p> : null}
      </div>

      <div className="grid gap-4">
        <label className="space-y-2">
          <span className="text-sm font-medium text-foreground">Task title</span>
          <Input
            autoFocus
            placeholder="Write the block exactly how you want to execute it"
            value={values.title}
            error={errors.title}
            onChange={(event) => setField("title", event.target.value)}
          />
          {errors.title ? <p className="text-sm text-danger">{errors.title}</p> : null}
        </label>

        <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr_1fr]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">Date</span>
            <Input
              type="date"
              value={values.taskDate}
              error={errors.taskDate}
              onChange={(event) => setField("taskDate", event.target.value)}
            />
            {errors.taskDate ? <p className="text-sm text-danger">{errors.taskDate}</p> : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">Start time</span>
            <Input
              type="time"
              value={values.startTime}
              error={errors.startTime}
              onChange={(event) => setField("startTime", event.target.value)}
            />
            {errors.startTime ? <p className="text-sm text-danger">{errors.startTime}</p> : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-foreground">End time</span>
            <Input
              type="time"
              value={values.endTime}
              error={errors.endTime}
              onChange={(event) => setField("endTime", event.target.value)}
            />
            {errors.endTime ? <p className="text-sm text-danger">{errors.endTime}</p> : null}
            {!isEndTimeDirty && mode === "create" ? (
              <p className="text-xs text-secondary-foreground">End time follows the start until you change it.</p>
            ) : null}
          </label>
        </div>
        <p className="text-xs text-secondary-foreground">This block lands on {formatDateLabel(values.taskDate)}.</p>

        {values.taskType === "meeting" ? (
          <div className="rounded-[20px] border border-primary/10 bg-cyan-50/35 p-4">
            <div className="grid gap-4">
              <label className="space-y-2">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  <Link2 className="h-4 w-4 text-secondary-foreground" />
                  Meeting link
                </span>
                <Input
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={values.meetingLink ?? ""}
                  error={errors.meetingLink}
                  onChange={(event) => setField("meetingLink", event.target.value)}
                />
                {errors.meetingLink ? <p className="text-sm text-danger">{errors.meetingLink}</p> : null}
              </label>

              <div className="space-y-2">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                  <Users className="h-4 w-4 text-secondary-foreground" />
                  Tagged people
                </span>
                <ParticipantPicker
                  currentUserId={currentUserId}
                  value={values.participants}
                  onChange={(participants) => {
                    setValues((current) => ({
                      ...current,
                      participants,
                    }));
                    setErrors((current) => ({
                      ...current,
                      participants: "",
                    }));
                  }}
                  disabled={isPending}
                />
                {errors.participants ? <p className="text-sm text-danger">{errors.participants}</p> : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-border/80 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {mode === "edit" && onDelete ? (
            <Button type="button" variant="danger" onClick={onDelete} disabled={isPending}>
              <Trash2 className="h-4 w-4" />
              Delete block
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {mode === "create" ? "Save block" : "Update block"}
          </Button>
        </div>
      </div>
    </form>
  );
}
