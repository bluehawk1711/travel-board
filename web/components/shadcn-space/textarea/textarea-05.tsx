import { useId } from 'react'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export interface AutoGrowTextareaProps {
  label?: string
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  className?: string
  maxLength?: number
}

export function AutoGrowTextarea({
  label = 'Feedback',
  placeholder = 'Share your feedback here',
  value,
  onChange,
  className,
  maxLength,
}: AutoGrowTextareaProps) {
  const id = useId()

  return (
    <div className={className}>
      <div className="w-full space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <Textarea
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          maxLength={maxLength}
          className="field-sizing-content max-h-30 min-h-0 resize-none py-1.75"
        />
      </div>
    </div>
  )
}

const TextareaAutoGrowDemo = () => {
  return <AutoGrowTextarea />
}

export default TextareaAutoGrowDemo