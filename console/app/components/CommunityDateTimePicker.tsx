import { ChevronDownIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

interface CommunityDateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  communityCreationYear?: number;
}

export function CommunityDateTimePicker({
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  communityCreationYear,
}: CommunityDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(value);
  const [timeInput, setTimeInput] = useState(
    value ? value.toTimeString().slice(0, 5) : "",
  );

  // Sync internal state with external value prop
  useEffect(() => {
    setDate(value);
    setTimeInput(value ? value.toTimeString().slice(0, 5) : "");
  }, [value]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      setDate(undefined);
      setTimeInput("");
      onChange(undefined);
      setOpen(false);
      return;
    }

    // If we have a time input, combine it with the selected date
    if (timeInput) {
      const [hours, minutes] = timeInput.split(":").map(Number);
      if (
        hours !== undefined &&
        minutes !== undefined &&
        !Number.isNaN(hours) &&
        !Number.isNaN(minutes)
      ) {
        const newDate = new Date(selectedDate);
        newDate.setHours(hours, minutes, 0, 0);
        setDate(newDate);
        onChange(newDate);
      } else {
        setDate(selectedDate);
        onChange(selectedDate);
      }
    } else {
      setDate(selectedDate);
      onChange(selectedDate);
    }

    setOpen(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTimeInput(newTime);

    if (date && newTime) {
      const [hours, minutes] = newTime.split(":").map(Number);
      if (
        hours !== undefined &&
        minutes !== undefined &&
        !Number.isNaN(hours) &&
        !Number.isNaN(minutes)
      ) {
        const newDate = new Date(date);
        newDate.setHours(hours, minutes, 0, 0);
        onChange(newDate);
      }
    }
  };

  return (
    <div className="flex gap-3">
      <div className="flex-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="w-full justify-between font-normal h-10"
            >
              {date ? date.toLocaleDateString() : "날짜 선택"}
              <ChevronDownIcon className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              captionLayout="dropdown"
              onSelect={handleDateSelect}
              startMonth={
                new Date(
                  communityCreationYear ?? new Date().getFullYear() - 1,
                  0,
                )
              }
              endMonth={new Date(new Date().getFullYear() + 5, 11)}
              disabled={[
                ...(minDate ? [{ before: minDate }] : []),
                ...(maxDate ? [{ after: maxDate }] : []),
              ]}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="w-32">
        <Input
          type="time"
          value={timeInput}
          onChange={handleTimeChange}
          disabled={disabled || !date}
          className="h-10 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </div>
    </div>
  );
}
