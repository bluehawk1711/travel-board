"use client";

import { useId, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@/components/ui/autocomplete";
import { Label } from "@/components/ui/label";

export interface AutocompleteOption {
  id: string;
  label: string;
  icon?: ReactNode;
}

const SPRING = { type: "spring", bounce: 0.15, duration: 0.3 } as const;

export interface IconAutocompleteProps {
  label?: string;
  placeholder?: string;
  options: AutocompleteOption[];
  /** Called with the selected option id + label (or null when cleared). */
  onSelect?: (value: string | null, label: string | null) => void;
  className?: string;
}

const IconAutocomplete = ({
  label,
  placeholder = "Search...",
  options,
  onSelect,
  className,
}: IconAutocompleteProps) => {
  const id = useId();
  const [inputValue, setInputValue] = useState("");
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  const selectedItem = options.find((item) => item.id === selectedValue);
  const showIcon = !!selectedItem && inputValue === selectedItem.label;

  const filtered = options.filter((item) =>
    item.label.toLowerCase().includes(inputValue.toLowerCase()),
  );

  return (
    <div className={className}>
      <Autocomplete
        onInputValueChange={(v) => {
          setInputValue(v);
          if (!v) onSelect?.(null, null);
        }}
        onValueChange={(v) => {
          setSelectedValue(v);
          const item = options.find((o) => o.id === v);
          onSelect?.(v, item?.label ?? null);
        }}
      >
        <div className="flex flex-col items-start gap-2">
          {label ? <Label htmlFor={id}>{label}</Label> : null}
          <div className="relative w-full">
            {showIcon && (
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 [&_svg]:size-4 [&_svg]:shrink-0">
                {selectedItem.icon}
              </span>
            )}
            <AutocompleteInput
              id={id}
              placeholder={placeholder}
              className={showIcon ? "pl-8" : undefined}
              showClear
            />
          </div>
        </div>

        <AutocompleteContent>
          <AutocompleteList>
            {filtered.length === 0 ? (
              <AutocompleteEmpty>No matches found.</AutocompleteEmpty>
            ) : (
              filtered.map((item, idx) => (
                <AutocompleteItem
                  key={item.id}
                  value={item.id}
                  label={item.label}
                >
                  <motion.div
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING, delay: idx * 0.04 }}
                    className="flex w-full items-center gap-2"
                  >
                    {item.icon && (
                      <span className="text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0">
                        {item.icon}
                      </span>
                    )}
                    {item.label}
                  </motion.div>
                </AutocompleteItem>
              ))
            )}
          </AutocompleteList>
        </AutocompleteContent>
      </Autocomplete>
    </div>
  );
};

export default IconAutocomplete;