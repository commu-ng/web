import { format } from "date-fns";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

interface DateTimePickerFieldProps {
  label: string;
  value: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  placeholder?: string;
}

export function DateTimePickerField({
  label,
  value,
  onSelect,
  disabled,
  placeholder = "날짜 선택",
}: DateTimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [timeValue, setTimeValue] = useState<string>(
    value ? format(value, "HH:mm") : "00:00",
  );

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      onSelect(undefined);
      setOpen(false);
      return;
    }

    // Parse the time from timeValue
    const [hours, minutes] = timeValue.split(":").map(Number);

    // Create new date with the selected date and current time
    const newDateTime = new Date(selectedDate);
    newDateTime.setHours(hours || 0, minutes || 0, 0, 0);

    onSelect(newDateTime);
    setOpen(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTimeValue = e.target.value;
    setTimeValue(newTimeValue);

    if (value) {
      // Parse the new time
      const [hours, minutes] = newTimeValue.split(":").map(Number);

      // Create new date with existing date and new time
      const newDateTime = new Date(value);
      newDateTime.setHours(hours || 0, minutes || 0, 0, 0);

      onSelect(newDateTime);
    }
  };

  return (
    <div className="flex gap-4">
      <div className="flex flex-col gap-3 flex-1">
        <Label htmlFor={`date-picker-${label}`} className="px-1">
          {label}
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              id={`date-picker-${label}`}
              className={cn(
                "justify-between font-normal",
                !value && "text-muted-foreground",
              )}
            >
              {value ? format(value, "yyyy년 MM월 dd일") : placeholder}
              <ChevronDownIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={value}
              captionLayout="dropdown"
              onSelect={handleDateSelect}
              disabled={disabled}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-col gap-3">
        <Label htmlFor={`time-picker-${label}`} className="px-1">
          시간
        </Label>
        <Input
          type="time"
          id={`time-picker-${label}`}
          value={timeValue}
          onChange={handleTimeChange}
          className="w-32 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </div>
    </div>
  );
}
