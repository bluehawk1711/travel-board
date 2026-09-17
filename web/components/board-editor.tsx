"use client";

import { useRef, useState, type ReactNode } from "react";
import Draggable, { type DraggableData } from "react-draggable";
import { GripVertical, Layers, Plus, Settings2, Trash2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import TabsScrollSwitch, {
  type Tabs07Tab,
} from "@/components/shadcn-space/tabs/tabs-07";
import SortableGrid, {
  type SortableItem,
} from "@/components/shadcn-space/sortable/sortable-02";
import RangeCalendar from "@/components/shadcn-space/calendar/calendar-14";
import { AutoGrowTextarea } from "@/components/shadcn-space/textarea/textarea-05";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  applyBoardChange,
  type BoardDetail,
  type BoardItem,
  type BoardSection,
} from "@/lib/board-types";
import {
  createItem,
  createSection,
  deleteItem,
  deleteSection,
  reorderBoardItems,
  updateBoard,
  updateItem,
  updateSection,
  type UpdateBoardPayload,
} from "@/lib/board-edit";
import { fetchBoard } from "@/lib/api";

const ITEM_TYPES: { id: BoardItem["type"]; label: string }[] = [
  { id: "PLACE", label: "Place" },
  { id: "RESTAURANT", label: "Restaurant" },
  { id: "HOTEL", label: "Hotel" },
  { id: "ACTIVITY", label: "Activity" },
  { id: "LINK", label: "Link" },
  { id: "NOTE", label: "Note" },
  { id: "IMAGE", label: "Image" },
];

interface BoardEditorProps {
  board: BoardDetail;
  onChange: (board: BoardDetail) => void;
  onExit: () => void;
}

/**
 * One section block wrapped in react-draggable. `nodeRef` is required in
 * React 19 (react-draggable can no longer use findDOMNode), and lets us read
 * the dragged node's rect in onStop to decide where to move it.
 */
function DraggableSection({
  sectionId,
  onDragStop,
  children,
}: {
  sectionId: string;
  onDragStop: (
    sectionId: string,
    node: HTMLElement,
    data: DraggableData,
  ) => void;
  children: ReactNode;
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  return (
    <Draggable
      axis="y"
      handle=".section-drag-handle"
      bounds="parent"
      nodeRef={nodeRef}
      onStop={(e, data) => {
        if (nodeRef.current) {
          onDragStop(sectionId, nodeRef.current, data);
        }
      }}
    >
      <div
        ref={nodeRef}
        data-section-block
        data-section-id={sectionId}
        className="rounded-xl border border-border bg-background p-4"
      >
        {children}
      </div>
    </Draggable>
  );
}

/** Keeps item/section operations simple: mutate, persist, apply locally. */
export function BoardEditor({ board, onChange, onExit }: BoardEditorProps) {
  const [sections, setSections] = useState<BoardSection[]>(board.sections);
  const sectionsRef = useRef<HTMLDivElement | null>(null);

  // Item editor sheet state.
  const [editingItem, setEditingItem] = useState<{
    sectionId: string;
    item: BoardItem | null;
  } | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [itemType, setItemType] = useState<BoardItem["type"]>("NOTE");
  const [itemSaving, setItemSaving] = useState(false);

  // Details form state.
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description ?? "");
  const [destination, setDestination] = useState(board.destination ?? "");
  const [dateRange, setDateRange] = useState<DateRange | null>(
    board.startDate || board.endDate
      ? {
          from: board.startDate ? new Date(board.startDate) : undefined,
          to: board.endDate ? new Date(board.endDate) : undefined,
        }
      : null,
  );
  const [boardType, setBoardType] = useState(board.boardType);
  const [visibility, setVisibility] = useState(board.visibility);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const openAddItem = (sectionId: string) => {
    setEditingItem({ sectionId, item: null });
    setItemTitle("");
    setItemDescription("");
    setItemUrl("");
    setItemType("NOTE");
  };

  const openEditItem = (sectionId: string, item: BoardItem) => {
    setEditingItem({ sectionId, item });
    setItemTitle(item.title);
    setItemDescription(item.description ?? "");
    setItemUrl(item.url ?? "");
    setItemType(item.type);
  };

  const saveItem = async () => {
    if (!editingItem || !itemTitle.trim()) return;
    setItemSaving(true);
    try {
      const payload = {
        title: itemTitle.trim(),
        description: itemDescription.trim() || undefined,
        url: itemUrl.trim() || undefined,
      };
      if (editingItem.item) {
        const updated = await updateItem(editingItem.item.id, payload);
        onChange(
          applyBoardChange(board, {
            type: "item:updated",
            boardId: board.id,
            actorId: "",
            at: new Date().toISOString(),
            item: updated,
            itemId: updated.id,
          }),
        );
      } else {
        const created = await createItem(board.id, {
          type: itemType,
          sectionId: editingItem.sectionId,
          ...payload,
        });
        onChange(
          applyBoardChange(board, {
            type: "item:created",
            boardId: board.id,
            actorId: "",
            at: new Date().toISOString(),
            item: created,
          }),
        );
      }
      setEditingItem(null);
    } catch {
      // surface via the sheet? Keep simple: close only on success above.
    } finally {
      setItemSaving(false);
    }
  };

  const removeItem = async () => {
    if (!editingItem?.item) return;
    try {
      await deleteItem(editingItem.item.id);
      onChange(
        applyBoardChange(board, {
          type: "item:removed",
          boardId: board.id,
          actorId: "",
          at: new Date().toISOString(),
          itemId: editingItem.item.id,
        }),
      );
      setEditingItem(null);
    } catch {
      // ignore
    }
  };

  const reorderItems = async (sectionId: string, next: SortableItem[]) => {
    const orderedItemIds = next.map((i) => i.id);
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              items: orderedItemIds
                .map((id) => s.items.find((i) => i.id === id))
                .filter((i): i is BoardItem => Boolean(i)),
            }
          : s,
      ),
    );
    onChange(
      applyBoardChange(board, {
        type: "items:reordered",
        boardId: board.id,
        actorId: "",
        at: new Date().toISOString(),
        sectionId,
        orderedItemIds,
      }),
    );
    await reorderBoardItems(board.id, sectionId, orderedItemIds).catch(
      () => undefined,
    );
  };

  const addSection = async () => {
    try {
      const section = await createSection(
        board.id,
        `Day ${sections.length + 1}`,
      );
      const next = [...sections, section];
      setSections(next);
      onChange(
        applyBoardChange(board, {
          type: "section:created",
          boardId: board.id,
          actorId: "",
          at: new Date().toISOString(),
          section,
        }),
      );
    } catch {
      // ignore
    }
  };

  const renameSection = async (sectionId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const updated = await updateSection(sectionId, { title: newTitle.trim() });
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? updated : s)),
      );
      onChange(
        applyBoardChange(board, {
          type: "section:updated",
          boardId: board.id,
          actorId: "",
          at: new Date().toISOString(),
          section: updated,
          sectionId,
        }),
      );
    } catch {
      // ignore
    }
  };

  const removeSection = async (sectionId: string) => {
    try {
      await deleteSection(sectionId);
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      onChange(
        applyBoardChange(board, {
          type: "section:removed",
          boardId: board.id,
          actorId: "",
          at: new Date().toISOString(),
          sectionId,
        }),
      );
    } catch {
      // ignore
    }
  };

  // react-draggable: swap the dragged section with whichever block its center
  // lands on, then persist the new positions.
  const handleSectionDragStop = (
    sectionId: string,
    node: HTMLElement,
    data: DraggableData,
  ) => {
    if (data.y === 0 && data.deltaY === 0) return;
    const container = sectionsRef.current;
    if (!container) return;
    const blocks = Array.from(
      container.querySelectorAll<HTMLElement>("[data-section-block]"),
    );
    const draggedRect = node.getBoundingClientRect();
    const draggedCenter = draggedRect.top + draggedRect.height / 2;
    const target = blocks.find((el) => {
      if (el.dataset.sectionId === sectionId) return false;
      const rect = el.getBoundingClientRect();
      return draggedCenter > rect.top && draggedCenter < rect.bottom;
    });
    if (!target) return;

    const fromIndex = sections.findIndex((s) => s.id === sectionId);
    const toIndex = sections.findIndex((s) => s.id === target.dataset.sectionId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    const next = [...sections];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setSections(next);
    onChange({ ...board, sections: next });
    // Persist: assign sequential positions.
    void Promise.all(
      next.map((s, i) =>
        updateSection(s.id, { position: i }).catch(() => undefined),
      ),
    );
  };

  const saveDetails = async () => {
    setDetailsSaving(true);
    setDetailsError(null);
    try {
      const payload: UpdateBoardPayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        destination: destination.trim() || undefined,
        boardType,
        visibility,
        startDate: dateRange?.from?.toISOString(),
        endDate: dateRange?.to?.toISOString(),
      };
      await updateBoard(board.id, payload);
      const fresh = await fetchBoard(board.id);
      onChange(fresh);
      setSections(fresh.sections);
    } catch {
      setDetailsError("Couldn't save — check your connection and permissions.");
    } finally {
      setDetailsSaving(false);
    }
  };

  const tabs: Tabs07Tab[] = [
    {
      id: "sections",
      label: "Sections",
      icon: Layers,
      stats: [],
      features: [],
      status: `${sections.length}`,
    },
    {
      id: "details",
      label: "Details",
      icon: Settings2,
      stats: [],
      features: [],
      status: "form",
    },
  ];

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Edit mode — drag items to reorder, drag sections by their handle.
        </p>
        <Button variant="outline" size="sm" className="cursor-pointer" onClick={onExit}>
          Done
        </Button>
      </div>

      <TabsScrollSwitch
        tabs={tabs}
        renderContent={(tab) =>
          tab.id === "sections" ? (
            <div className="flex flex-col gap-6">
              {/* Sections (react-draggable vertical reorder) */}              <div ref={sectionsRef} className="flex flex-col gap-4">
                {sections.map((section) => (
                  <DraggableSection
                    key={section.id}
                    sectionId={section.id}
                    onDragStop={handleSectionDragStop}
                  >
                      <div className="mb-3 flex items-center gap-2">
                        <span className="section-drag-handle cursor-grab text-muted-foreground active:cursor-grabbing">
                          <GripVertical className="size-4" />
                        </span>
                        <input
                          key={section.id}
                          defaultValue={section.title}
                          onBlur={(e) => {
                            if (e.target.value !== section.title) {
                              void renameSection(section.id, e.target.value);
                            }
                          }}
                          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold outline-none transition-colors hover:border-border focus:border-ring"
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="cursor-pointer text-muted-foreground hover:text-destructive"
                          aria-label="Delete section"
                          onClick={() => void removeSection(section.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => openAddItem(section.id)}
                        >
                          <Plus /> Add
                        </Button>
                      </div>

                      {section.items.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                          No items — add one.
                        </p>
                      ) : (
                        <SortableGrid
                          items={section.items.map((item) => ({
                            id: item.id,
                            title: item.title,
                            description: item.description ?? undefined,
                            type: item.type.toLowerCase(),
                            meta: item.date ?? undefined,
                          }))}
                          onReorder={(next) => void reorderItems(section.id, next)}
                          columnsClassName="grid-cols-2 sm:grid-cols-3"
                          renderItem={(item) => {
                            const real = section.items.find(
                              (i) => i.id === item.id,
                            );
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() =>
                                  real && openEditItem(section.id, real)
                                }
                                className="w-full cursor-pointer rounded-2xl border border-border bg-card p-4 text-left shadow-lg transition-transform hover:scale-[1.02]"
                              >
                                <p className="truncate text-sm font-semibold">
                                  {item.title}
                                </p>
                                {item.description && (
                                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                    {item.description}
                                  </p>
                                )}
                              </button>
                            );
                          }}
                        />
                      )}
                  </DraggableSection>
                ))}
              </div>

              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={() => void addSection()}
              >
                <Plus /> Add section
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
              </div>

              <AutoGrowTextarea
                label="Description"
                value={description}
                onChange={setDescription}
              />

              <div className="space-y-2">
                <Label>Destination</Label>
                <Input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label>Trip dates</Label>
                <RangeCalendar
                  value={dateRange ?? undefined}
                  onValueChange={(range) => setDateRange(range ?? null)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Board type</Label>
                  <div className="flex gap-2">
                    {(["ITINERARY", "FREEFORM"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setBoardType(option)}
                        className={cn(
                          "flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                          boardType === option
                            ? "border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                            : "border-border text-muted-foreground hover:bg-muted/60",
                        )}
                      >
                        {option === "ITINERARY" ? "Itinerary" : "Freeform"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <div className="flex gap-2">
                    {(["PUBLIC", "PRIVATE"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setVisibility(option)}
                        className={cn(
                          "flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                          visibility === option
                            ? "border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                            : "border-border text-muted-foreground hover:bg-muted/60",
                        )}
                      >
                        {option === "PUBLIC" ? "Public" : "Private"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {detailsError && (
                <p className="text-sm text-destructive">{detailsError}</p>
              )}

              <div className="flex justify-end">
                <Button
                  className="cursor-pointer"
                  disabled={detailsSaving}
                  onClick={() => void saveDetails()}
                >
                  {detailsSaving ? "Saving…" : "Save details"}
                </Button>
              </div>
            </div>
          )
        }
      />

      {/* Item editor sheet */}
      <Sheet
        open={Boolean(editingItem)}
        onOpenChange={(open) => !open && setEditingItem(null)}
      >
        <SheetContent side="right" className="p-6">
          <SheetHeader>
            <SheetTitle>
              {editingItem?.item ? "Edit item" : "Add item"}
            </SheetTitle>
            <SheetDescription>
              {editingItem?.item
                ? "Update this item — changes broadcast live."
                : "Add a place, activity, link or note to this section."}
            </SheetDescription>
          </SheetHeader>

          {!editingItem?.item && (
            <div className="flex flex-wrap gap-2">
              {ITEM_TYPES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setItemType(option.id)}
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    itemType === option.id
                      ? "border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                      : "border-border text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="item-title">Title</Label>
              <Input
                id="item-title"
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                maxLength={200}
              />
            </div>
            <AutoGrowTextarea
              label="Description"
              value={itemDescription}
              onChange={setItemDescription}
            />
            <div className="space-y-2">
              <Label htmlFor="item-url">URL</Label>
              <Input
                id="item-url"
                value={itemUrl}
                onChange={(e) => setItemUrl(e.target.value)}
                placeholder="https://…"
                maxLength={2000}
              />
            </div>
          </div>

          <SheetFooter className="mt-auto">
            {editingItem?.item && (
              <Button
                variant="destructive"
                className="cursor-pointer"
                onClick={() => void removeItem()}
              >
                <Trash2 /> Delete
              </Button>
            )}
            <Button
              className="cursor-pointer"
              disabled={itemSaving || !itemTitle.trim()}
              onClick={() => void saveItem()}
            >
              {itemSaving ? "Saving…" : editingItem?.item ? "Save" : "Add"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}