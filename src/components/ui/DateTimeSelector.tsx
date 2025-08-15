import React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DateTimeSelectorProps {
  // Date range selection
  showDateRange?: boolean
  dateFrom?: Date
  dateTo?: Date
  onDateFromChange?: (date: Date | undefined) => void
  onDateToChange?: (date: Date | undefined) => void
  
  // Time selection
  showTimeSelector?: boolean
  timeValue?: string
  onTimeChange?: (time: string) => void
  timeLabel?: string
  
  // Timezone selection
  showTimezoneSelector?: boolean
  timezoneValue?: string
  onTimezoneChange?: (timezone: string) => void
  timezoneLabel?: string
  
  // Date range presets
  showDateRangePresets?: boolean
  dateRangeValue?: string
  onDateRangeChange?: (range: string) => void
  dateRangeLabel?: string
  
  // Layout
  className?: string
  layout?: 'horizontal' | 'vertical' | 'grid'
}

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { value: "Asia/Jakarta", label: "Asia/Jakarta (WIB +7)" },
  { value: "Asia/Makassar", label: "Asia/Makassar (WITA +8)" },
  { value: "Asia/Jayapura", label: "Asia/Jayapura (WIT +9)" },
]

const DATE_RANGE_OPTIONS = [
  { value: "1d", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
]

export const DateTimeSelector: React.FC<DateTimeSelectorProps> = ({
  showDateRange = false,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  showTimeSelector = false,
  timeValue,
  onTimeChange,
  timeLabel = "Time",
  showTimezoneSelector = false,
  timezoneValue,
  onTimezoneChange,
  timezoneLabel = "Timezone",
  showDateRangePresets = false,
  dateRangeValue,
  onDateRangeChange,
  dateRangeLabel = "Date Range",
  className,
  layout = 'grid'
}) => {
  const getLayoutClasses = () => {
    switch (layout) {
      case 'horizontal':
        return 'flex flex-wrap gap-4'
      case 'vertical':
        return 'space-y-4'
      case 'grid':
      default:
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
    }
  }

  return (
    <div className={cn(getLayoutClasses(), className)}>
      {/* Date Range Presets */}
      {showDateRangePresets && (
        <div className="space-y-2">
          <Label>{dateRangeLabel}</Label>
          <Select value={dateRangeValue} onValueChange={onDateRangeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Custom Date Range */}
      {showDateRange && (
        <>
          <div className="space-y-2">
            <Label>From Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={onDateFromChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>To Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={onDateToChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </>
      )}

      {/* Time Selector */}
      {showTimeSelector && (
        <div className="space-y-2">
          <Label>{timeLabel}</Label>
          <Input
            type="time"
            value={timeValue}
            onChange={(e) => onTimeChange?.(e.target.value)}
          />
        </div>
      )}

      {/* Timezone Selector */}
      {showTimezoneSelector && (
        <div className="space-y-2">
          <Label>{timezoneLabel}</Label>
          <Select value={timezoneValue} onValueChange={onTimezoneChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}

export default DateTimeSelector