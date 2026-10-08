"use client";

import { CalendarIcon, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const formatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function pad(value: number) {
  return String(value).padStart(2, "0");
}

interface DateTimePickerProps {
  /** ISO datetime string, or null when unset. */
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  disabled,
  id,
  placeholder = "Pick a date and time",
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? new Date(value) : undefined;
  const valid = !!selected && !Number.isNaN(selected.getTime());
  const today = React.useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
  }, []);

  const commit = (date: Date) => onChange(date.toISOString());

  const pickDate = (date: Date | undefined) => {
    if (!date) return;
    const next = new Date(date);
    if (valid) {
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    } else {
      next.setHours(23, 59, 0, 0);
    }
    commit(next);
  };

  const pickTime = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
    const base = valid ? selected : new Date();
    const next = new Date(base);
    next.setHours(hours, minutes, 0, 0);
    commit(next);
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn("w-full justify-start font-normal", !valid && "text-muted-foreground")}
            data-testid="datetime-picker-trigger"
          >
            <CalendarIcon className="h-4 w-4" />
            {valid ? formatter.format(selected) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={valid ? selected : undefined}
            onSelect={pickDate}
            disabled={{ before: today }}
          />
          <div className="flex items-center gap-2 border-t p-3">
            <Input
              type="time"
              aria-label="Time"
              value={valid ? `${pad(selected.getHours())}:${pad(selected.getMinutes())}` : ""}
              onChange={(e) => pickTime(e.target.value)}
              disabled={disabled}
              className="w-fit"
            />
          </div>
        </PopoverContent>
      </Popover>
      {valid && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear date and time"
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
