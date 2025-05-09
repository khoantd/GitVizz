"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ReactFlowProvider } from "@xyflow/react";
import ReactFlowCodeViewer from "./ReactFlowCodeViewer";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  module?: string;
  docstring?: string;
  line?: number;
  code?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: Record<string, unknown>;
}

interface ReactFlowCodeViewerSheetProps {
  graphData?: GraphData;
  triggerText?: string;
  title?: string;
}

export function ReactFlowCodeViewerSheet({
  graphData,
  triggerText = "Open Code Flow Visualization",
  title = "Interactive Code Graph",
}: ReactFlowCodeViewerSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">{triggerText}</Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[90%] max-w-[90%] sm:max-w-[90%] overflow-hidden"
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Click on any node to view the code. You can zoom, pan, and rearrange
            nodes.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 h-[85vh]">
          <ReactFlowProvider>
            <ReactFlowCodeViewer graphData={graphData} className="h-full" />
          </ReactFlowProvider>
        </div>
      </SheetContent>
    </Sheet>
  );
}
