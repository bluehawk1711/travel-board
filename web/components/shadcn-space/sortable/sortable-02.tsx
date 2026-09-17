"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";

export interface SortableItem {
  id: string;
  title: string;
  description?: string;
  /** Badge label (e.g. item type). */
  type?: string;
  badgeClassName?: string;
  /** Optional right-side meta line. */
  meta?: string;
}

type CardProps = {
  item: SortableItem;
  className?: string;
  style?: React.CSSProperties;
  setNodeRef?: (node: HTMLElement | null) => void;
  attributes?: DraggableAttributes;
  listeners?: DraggableSyntheticListeners;
};

const ItemCard = ({
  item,
  className,
  style,
  setNodeRef,
  attributes,
  listeners,
}: CardProps) => {
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-card border-border flex cursor-grab flex-col gap-6 rounded-2xl border p-4 touch-none hover:bg-muted active:cursor-grabbing",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-foreground truncate text-sm font-semibold">
            {item.title}
          </span>
        </div>
        {item.description ? (
          <span className="text-muted-foreground line-clamp-2 text-sm">
            {item.description}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between">
        {item.type ? (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-medium",
              item.badgeClassName ?? "bg-muted text-foreground border-border",
            )}
          >
            {item.type}
          </span>
        ) : (
          <span />
        )}
        {item.meta ? (
          <span className="text-muted-foreground text-sm">{item.meta}</span>
        ) : null}
      </div>
    </div>
  );
};

const SortableCard = ({ item }: { item: SortableItem }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ItemCard
      item={item}
      setNodeRef={setNodeRef}
      style={style}
      attributes={attributes}
      listeners={listeners}
      className={cn(isDragging && "opacity-50")}
    />
  );
};

export interface SortableGridProps {
  items: SortableItem[];
  onReorder?: (items: SortableItem[]) => void;
  className?: string;
  columnsClassName?: string;
  renderItem?: (item: SortableItem) => ReactNode;
}

const SortableGrid = ({
  items: itemsProp,
  onReorder,
  className,
  columnsClassName = "grid-cols-1 sm:grid-cols-3",
  renderItem,
}: SortableGridProps) => {
  const [items, setItems] = useState<SortableItem[]>(itemsProp);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sync when the parent refetches.
  const [prevItems, setPrevItems] = useState(itemsProp);
  if (prevItems !== itemsProp) {
    setPrevItems(itemsProp);
    setItems(itemsProp);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const activeItem = items.find((item) => item.id === activeId) ?? null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      onReorder?.(next);
      return next;
    });
  };

  return (
    <div className={cn("w-full", className)}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={rectSortingStrategy}
        >
          <div className={cn("grid gap-3", columnsClassName)}>
            {items.map((item) => (
              <SortableCard key={item.id} item={item} />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeItem ? (
            renderItem ? (
              renderItem(activeItem)
            ) : (
              <ItemCard item={activeItem} className="shadow-lg" />
            )
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default SortableGrid;