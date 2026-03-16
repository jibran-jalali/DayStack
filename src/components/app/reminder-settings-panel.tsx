import { Bell, BellOff, LoaderCircle, Send } from "lucide-react";

import { Button } from "@/components/shared/button";
import { StatusChip } from "@/components/shared/status-chip";
import { cn } from "@/lib/utils";
import type { OneSignalSubscriptionState, UserNotificationPreferencesRecord } from "@/types/daystack";

interface ReminderSettingsPanelProps {
  isBusy: boolean;
  isHighlighted?: boolean;
  notificationState: OneSignalSubscriptionState;
  onSendTest: () => void;
  onTogglePush: (nextValue: boolean) => void;
  onToggleSetting: (
    key: "remind_5_min_before" | "remind_at_start" | "remind_overdue",
    nextValue: boolean,
  ) => void;
  preferences: UserNotificationPreferencesRecord;
}

function ToggleRow({
  checked,
  description,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled: boolean;
  label: string;
  onChange: (nextValue: boolean) => void;
}) {
  return (
    <button
      suppressHydrationWarning
      type="button"
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-[16px] border border-border/70 bg-white/72 px-3 py-2.5 text-left transition-[transform,box-shadow,border-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
        disabled ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(15,23,42,0.05)]",
      )}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
    >
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-secondary-foreground">{description}</span>
      </span>
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-brand-gradient shadow-[0_10px_18px_rgba(23,102,214,0.18)]" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_4px_10px_rgba(15,23,42,0.14)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
            checked ? "translate-x-[1.35rem]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function ReminderSettingsPanel({
  isBusy,
  isHighlighted,
  notificationState,
  onSendTest,
  onTogglePush,
  onToggleSetting,
  preferences,
}: ReminderSettingsPanelProps) {
  const isPushReady = notificationState.configured && notificationState.supported;
  const isPushEnabled = preferences.push_enabled && notificationState.subscribed;
  const helperText = !notificationState.configured
    ? "Add your OneSignal env vars to turn on web push."
    : !notificationState.supported
      ? "This browser does not support web push."
      : isPushEnabled
        ? "Push is active on this browser."
        : "Turn on push when you want DayStack to nudge the plan.";

  return (
    <section
      id="reminder-settings-panel"
      className={cn(
        "rounded-[18px] border border-border/70 bg-white/78 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition-[box-shadow,border-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        isHighlighted && "border-primary/30 shadow-[0_18px_36px_rgba(24,190,239,0.12)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground/70">Reminders</p>
          <p className="mt-2 text-sm text-secondary-foreground">{helperText}</p>
        </div>
        <StatusChip
          label={isPushEnabled ? "On" : "Off"}
          tone={isPushEnabled ? "brand" : "default"}
          icon={isPushEnabled ? Bell : BellOff}
          className="shrink-0"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={isBusy || !notificationState.configured || !notificationState.supported}
          onClick={() => onTogglePush(!isPushEnabled)}
        >
          {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : isPushEnabled ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          {isPushEnabled ? "Pause reminders" : "Enable reminders"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={isBusy || !isPushEnabled}
          onClick={onSendTest}
        >
          <Send className="h-4 w-4" />
          Test notification
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        <ToggleRow
          checked={preferences.remind_5_min_before}
          description="Catch the block before it begins."
          disabled={isBusy || !isPushReady}
          label="5 min before"
          onChange={(nextValue) => onToggleSetting("remind_5_min_before", nextValue)}
        />
        <ToggleRow
          checked={preferences.remind_at_start}
          description="Nudge the exact start time."
          disabled={isBusy || !isPushReady}
          label="At start"
          onChange={(nextValue) => onToggleSetting("remind_at_start", nextValue)}
        />
        <ToggleRow
          checked={preferences.remind_overdue}
          description="Flag unfinished blocks once they run over."
          disabled={isBusy || !isPushReady}
          label="Overdue"
          onChange={(nextValue) => onToggleSetting("remind_overdue", nextValue)}
        />
      </div>
    </section>
  );
}
