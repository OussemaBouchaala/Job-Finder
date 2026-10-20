import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { AppShell } from "@/components/AppShell";
import { Skeleton, cn } from "@/components/ui";
import { STATUSES, STATUS_STYLE, type Host } from "@/lib/jobs";
import { DeadlinePill } from "./Dashboard";

export function Board({ email }: { email: string }) {
  const [hosts, setHosts] = useState<Host[] | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  useEffect(() => {
    supabase
      .from("hosts")
      .select("*")
      .order("rank")
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setHosts((data as Host[]) ?? []);
      });
  }, []);

  const onDragEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    const status = e.over?.id ? String(e.over.id) : null;
    if (!status || !(STATUSES as readonly string[]).includes(status)) return;
    const host = hosts?.find((h) => h.id === id);
    if (!host || host.status === status) return;
    setHosts((hs) => hs!.map((h) => (h.id === id ? { ...h, status } : h)));
    const { error } = await supabase.from("hosts").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      setHosts((hs) => hs!.map((h) => (h.id === id ? { ...h, status: host.status } : h)));
    } else toast.success(`${host.name} → ${status}`);
  };

  return (
    <AppShell email={email}>
      <h1 className="text-xl font-semibold">Application pipeline</h1>
      <p className="mt-1 text-sm text-muted-foreground">Drag a card to move it between stages.</p>
      {!hosts ? (
        <div className="mt-4 flex gap-3">
          {STATUSES.map((s) => (
            <Skeleton key={s} className="h-64 w-60 shrink-0" />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-4">
            {STATUSES.map((s) => (
              <Column key={s} status={s} hosts={hosts.filter((h) => h.status === s)} />
            ))}
          </div>
        </DndContext>
      )}
    </AppShell>
  );
}

function Column({ status, hosts }: { status: string; hosts: Host[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn("flex w-64 shrink-0 flex-col rounded-xl border bg-card p-2 transition-colors", isOver && "border-primary bg-accent/40")}>
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", STATUS_STYLE[status])}>{status}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{hosts.length}</span>
      </div>
      <div className="flex max-h-[70vh] min-h-24 flex-col gap-2 overflow-y-auto">
        {hosts.map((h) => (
          <BoardCard key={h.id} h={h} />
        ))}
        {hosts.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Drop here</p>}
      </div>
    </div>
  );
}

function BoardCard({ h }: { h: Host }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: h.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "cursor-grab touch-none rounded-lg border bg-background p-2.5 text-sm shadow-sm active:cursor-grabbing",
        isDragging && "z-50 opacity-70 shadow-lg",
      )}
    >
      <Link to="/jobs/$id" params={{ id: h.id }} className="font-medium leading-snug hover:underline" onClick={(e) => e.stopPropagation()}>
        {h.name}
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {h.place && <span className="truncate">{h.place}</span>}
        <DeadlinePill deadline={h.deadline} short />
      </div>
    </div>
  );
}
