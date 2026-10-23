import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MemberPicker({ value, onChange, members, placeholder = "בחר חבר קהילה" }) {
  const [open, setOpen] = useState(false);
  const selected = members.find((m) => m.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          {selected ? selected.name : <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="w-4 h-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandInput placeholder="חיפוש לפי שם / תז / טלפון..." />
          <CommandList>
            <CommandEmpty>לא נמצאו תוצאות</CommandEmpty>
            <CommandGroup>
              {members.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`${m.name || ""} ${m.id_number || ""} ${m.phone || ""} ${m.mobile || ""}`}
                  onSelect={() => { onChange(m.id); setOpen(false); }}
                >
                  <Check className={cn("w-4 h-4 ml-1", value === m.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1">{m.name}</span>
                  {m._tag && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary ml-1">{m._tag}</span>
                  )}
                  {m.id_number && <span className="text-xs text-muted-foreground">{m.id_number}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}