
import React, { useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, X } from 'lucide-react';
import { format, parse } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CertificationSettings as SettingsType } from '@/types/student';
import { normalizeScore } from '@/utils/scoreUtils';

interface CertificationSettingsProps {
  settings: SettingsType;
  onSettingsChange: (settings: SettingsType) => void;
  className?: string;
}

const CertificationSettings = ({
  settings,
  onSettingsChange,
  className
}: CertificationSettingsProps) => {
  // Ensure passThreshold is in percentage format for display
  useEffect(() => {
    // If the threshold is in decimal format (0-1), convert to percentage
    if (settings.passThreshold > 0 && settings.passThreshold <= 1) {
      console.log("Converting pass threshold from decimal to percentage for display");
      onSettingsChange({
        ...settings,
        passThreshold: normalizeScore(settings.passThreshold, true)
      });
    }
  }, []);

  const handleThresholdChange = (value: number[]) => {
    onSettingsChange({
      ...settings,
      passThreshold: value[0]
    });
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      // Format as ISO string date part for consistent comparisons
      const formattedDate = format(date, 'yyyy-MM-dd');
      console.log("Setting date filter to:", formattedDate);
      
      onSettingsChange({
        ...settings,
        dateSince: formattedDate
      });
    } else {
      console.log("Clearing date filter");
      onSettingsChange({
        ...settings,
        dateSince: null
      });
    }
  };

  const clearDate = () => {
    console.log("Clearing date filter");
    onSettingsChange({
      ...settings,
      dateSince: null
    });
  };

  return (
    <div className={cn('space-y-6', className)}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="threshold" className="text-base">
            Pass Threshold
          </Label>
          <span className="text-sm font-medium text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded">
            {settings.passThreshold}%
          </span>
        </div>
        <Slider
          id="threshold"
          defaultValue={[settings.passThreshold]}
          max={100}
          min={0}
          step={5}
          onValueChange={handleThresholdChange}
          className="py-2"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Students must score at least {settings.passThreshold}% to be eligible for certification
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-base">Filter by Date</Label>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !settings.dateSince && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {settings.dateSince ? (
                format(new Date(settings.dateSince), "PPP")
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={settings.dateSince ? new Date(settings.dateSince) : undefined}
              onSelect={handleDateChange}
              initialFocus
              disabled={(date) => date > new Date()} // Prevent selecting future dates
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        
        {settings.dateSince && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Only showing students active since {format(new Date(settings.dateSince), "PPP")}
            </p>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-slate-500"
              onClick={clearDate}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CertificationSettings;
