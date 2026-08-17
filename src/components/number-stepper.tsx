"use client";

import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  className?: string;
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  step = 1,
  className,
}: NumberStepperProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 shrink-0"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        aria-label="Decrease"
      >
        <Minus />
      </Button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const next = Number(e.target.value);
          onChange(Number.isFinite(next) ? Math.max(min, Math.round(next)) : min);
        }}
        className="h-11 w-14 rounded-md border bg-transparent text-center text-base tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11 shrink-0"
        onClick={() => onChange(value + step)}
        aria-label="Increase"
      >
        <Plus />
      </Button>
    </div>
  );
}
