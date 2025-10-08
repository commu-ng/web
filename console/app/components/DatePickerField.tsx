import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

interface DatePickerFieldProps {
  label: string;
  value: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  placeholder?: string;
}

export function DatePickerField({
  label,
  value,
  onSelect,
  disabled,
  placeholder = "날짜를 선택하세요",
}: DatePickerFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "yyyy년 MM월 dd일") : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onSelect}
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
