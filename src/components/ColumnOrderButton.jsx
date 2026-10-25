import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Columns3, RotateCcw, Eye, EyeOff } from "lucide-react";

export default function ColumnOrderButton({ columns, order, onOrderChange, defaultOrder, hidden, onHiddenChange }) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(order);
  const [localHidden, setLocalHidden] = useState(hidden || []);

  const supportsHide = Array.isArray(hidden) && typeof onHiddenChange === "function";

  useEffect(() => { if (open) { setLocal(order); setLocalHidden(hidden || []); } }, [open, order, hidden]);

  const labelFor = (key) => columns.find((c) => c.key === key)?.label || key;

  const onDragEnd = (res) => {
    if (!res.destination) return;
    const next = Array.from(local);
    const [moved] = next.splice(res.source.index, 1);
    next.splice(res.destination.index, 0, moved);
    setLocal(next);
  };

  const toggleHidden = (key) => {
    setLocalHidden((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  const save = () => {
    onOrderChange(local);
    if (supportsHide) onHiddenChange(localHidden);
    setOpen(false);
  };

  const reset = () => {
    setLocal(defaultOrder || columns.map((c) => c.key));
    if (supportsHide) setLocalHidden([]);
  };

  const hiddenCount = supportsHide ? localHidden.length : 0;

  return (
    <>
      <Button variant="outline" type="button" onClick={() => setOpen(true)}>
        <Columns3 className="w-4 h-4 ml-1" /> סידור עמודות{supportsHide && hiddenCount > 0 ? ` (${hiddenCount} מוסתרות)` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Columns3 className="w-5 h-5" /> סידור והסתרת עמודות</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">גררו לסידור, ולחצו על סמל העין כדי להסתיר או להציג עמודה. ההגדרות נשמרות בדפדפן.</p>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="cols">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5 max-h-[50vh] overflow-y-auto scrollbar-thin">
                  {local.map((key, index) => {
                    const isHidden = localHidden.includes(key);
                    return (
                      <Draggable key={key} draggableId={key} index={index}>
                        {(p, snap) => (
                          <div
                            ref={p.innerRef}
                            {...p.draggableProps}
                            className={`flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 ${snap.isDragging ? "shadow-md border-primary" : ""} ${isHidden ? "opacity-50" : ""}`}
                          >
                            <span {...p.dragHandleProps} className="cursor-grab text-muted-foreground hover:text-primary">
                              <GripVertical className="w-4 h-4" />
                            </span>
                            <span className={`text-sm font-medium flex-1 ${isHidden ? "line-through text-muted-foreground" : ""}`}>{labelFor(key)}</span>
                            {supportsHide && (
                              <button
                                type="button"
                                onClick={() => toggleHidden(key)}
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary"
                                title={isHidden ? "הצג עמודה" : "הסתר עמודה"}
                              >
                                {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            )}
                            <span className="text-xs text-muted-foreground">{index + 1}</span>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          {supportsHide && hiddenCount > 0 && (
            <p className="text-xs text-muted-foreground">{hiddenCount} עמודות מוסתרות — לחץ על סמל העין הסגורה כדי להחזירן.</p>
          )}
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" type="button" onClick={reset}><RotateCcw className="w-4 h-4 ml-1" /> איפוס</Button>
            <div className="flex gap-2">
              <DialogClose asChild><Button variant="outline" type="button">ביטול</Button></DialogClose>
              <Button type="button" onClick={save}>שמירה</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}