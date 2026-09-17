'use client'

import { useState } from 'react'
import {
  endOfMonth,
  startOfMonth,
  subDays,
  subMonths,
  addDays,
  addMonths
} from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export interface RangePreset {
  label: string
  range: DateRange
}

export interface RangePresetGroup {
  label: string
  presets: RangePreset[]
}

export interface RangeCalendarProps {
  /** Controlled value; omit for internal state. */
  value?: DateRange | undefined
  onValueChange?: (range: DateRange | undefined) => void
  presets?: RangePresetGroup[]
  className?: string
}

const RangeSelectionDemo = ({
  value,
  onValueChange,
  presets,
  className,
}: RangeCalendarProps) => {
  const today = new Date()

  const presetGroups = presets ?? [
    {
      label: 'Days',
      presets: [
        { label: 'Today', range: { from: today, to: today } },
        { label: 'Yesterday', range: { from: subDays(today, 1), to: subDays(today, 1) } },
        { label: 'Tomorrow', range: { from: addDays(today, 1), to: addDays(today, 1) } }
      ]
    },
    {
      label: 'Weeks',
      presets: [
        { label: 'Last 7 days', range: { from: subDays(today, 6), to: today } },
        { label: 'Next 7 days', range: { from: addDays(today, 1), to: addDays(today, 7) } }
      ]
    },
    {
      label: 'Months',
      presets: [
        { label: 'Last 30 days', range: { from: subDays(today, 29), to: today } },
        { label: 'Month to date', range: { from: startOfMonth(today), to: today } },
        {
          label: 'Last month',
          range: {
            from: startOfMonth(subMonths(today, 1)),
            to: endOfMonth(subMonths(today, 1))
          }
        },
        {
          label: 'Next month',
          range: {
            from: startOfMonth(addMonths(today, 1)),
            to: endOfMonth(addMonths(today, 1))
          }
        }
      ]
    }
  ]

  const [month, setMonth] = useState(today)
  const [internal, setInternal] = useState<DateRange | undefined>(
    value ?? presetGroups[1]?.presets[0]?.range,
  )
  const date = value !== undefined ? value : internal

  const handleChange = (next: DateRange | undefined) => {
    if (value === undefined) setInternal(next)
    onValueChange?.(next)
  }

  const isActive = (range: DateRange) =>
    date?.from?.toDateString() === range.from?.toDateString() &&
    date?.to?.toDateString() === range.to?.toDateString()

  return (
    <>
      <Card className={cn('max-w-75 w-full overflow-hidden py-0', className)}>

        <CardContent className='px-4 pt-3 pb-0'>
          <Calendar
            mode='range'
            selected={date}
            onSelect={newDate => {
              if (newDate) handleChange(newDate)
            }}
            month={month}
            onMonthChange={setMonth}
            className='w-full bg-transparent p-0'
          />
        </CardContent>

        <CardFooter className='border-t p-0 bg-background'>
          <ScrollArea className='h-44 w-full'>
            <div className='flex flex-col gap-3 px-4 py-3'>
              {presetGroups.map(group => (
                <div key={group.label}>
                  <p className='text-muted-foreground mb-1.5 px-1 text-[10px] font-semibold tracking-widest uppercase'>
                    {group.label}
                  </p>
                  <div className='grid grid-cols-2 gap-1.5'>
                    {group.presets.map(preset => (
                      <Button
                        key={preset.label}
                        variant='ghost'
                        size='sm'
                        className={cn(
                          'h-7 justify-center text-xs font-normal cursor-pointer border border-border',
                          isActive(preset.range) &&
                          'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
                        )}
                        onClick={() => {
                          handleChange(preset.range)
                          setMonth(preset.range.to ?? preset.range.from ?? today)
                        }}
                      >
                        {isActive(preset.range) &&
                          <span
                            className='h-1.5 w-1.5 shrink-0 rounded-full bg-primary'
                          />
                        }
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardFooter>
      </Card>
    </>
  )
}

export default RangeSelectionDemo
