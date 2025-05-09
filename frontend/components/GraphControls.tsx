import { useState } from "react";
import { useThemeGraph } from "./use-theme-graph";
import type { Sigma } from "sigma";

interface GraphControlsProps {
  sigma: Sigma | null;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onToggleLegend?: () => void;
}

const GraphControls = ({
  sigma,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleLegend,
}: GraphControlsProps) => {
  const theme = useThemeGraph();
  const [showControls, setShowControls] = useState(true);

  const bgColor = theme === "dark" ? "bg-gray-800/90" : "bg-white/90";
  const textColor = theme === "dark" ? "text-gray-200" : "text-gray-800";
  const borderColor = theme === "dark" ? "border-gray-700" : "border-gray-300";
  const buttonHoverColor =
    theme === "dark" ? "hover:bg-gray-700" : "hover:bg-gray-100";

  const handleZoomIn = () => {
    if (onZoomIn) {
      onZoomIn();
    } else if (sigma) {
      const camera = sigma.getCamera();
      const ratio = camera.ratio;
      camera.animate({ ratio: ratio / 1.5 }, { duration: 200 });
    }
  };

  const handleZoomOut = () => {
    if (onZoomOut) {
      onZoomOut();
    } else if (sigma) {
      const camera = sigma.getCamera();
      const ratio = camera.ratio;
      camera.animate({ ratio: ratio * 1.5 }, { duration: 200 });
    }
  };

  const handleResetZoom = () => {
    if (onResetZoom) {
      onResetZoom();
    } else if (sigma) {
      sigma
        .getCamera()
        .animate({ x: 0.5, y: 0.5, ratio: 1 }, { duration: 300 });
    }
  };

  const handleToggleLegend = () => {
    if (onToggleLegend) {
      onToggleLegend();
    }
  };

  // Apply force layout
  const applyForceLayout = () => {
    if (!sigma) return;

    try {
      const graph = sigma.getGraph();

      // Import forceAtlas2 dynamically to avoid SSR issues
      import("graphology-layout-forceatlas2").then((forceAtlas2Module) => {
        const forceAtlas2 = forceAtlas2Module.default;

        // Apply layout with sensible defaults
        forceAtlas2.assign(graph, {
          iterations: 50,
          settings: {
            gravity: 1,
            scalingRatio: 10,
            strongGravityMode: true,
            slowDown: 5,
          },
        });

        // Refresh the rendering
        sigma.refresh();
      });
    } catch (error) {
      console.error("Error applying force layout:", error);
    }
  };

  // Apply circular layout
  const applyCircularLayout = () => {
    if (!sigma) return;

    try {
      const graph = sigma.getGraph();

      // Import circular layout dynamically to avoid SSR issues
      import("graphology-layout").then((layouts) => {
        const circular = layouts.circular;

        // Apply layout
        circular.assign(graph);

        // Refresh the rendering
        sigma.refresh();
      });
    } catch (error) {
      console.error("Error applying circular layout:", error);
    }
  };

  return (
    <div
      className={`fixed bottom-4 left-4 ${bgColor} ${textColor} rounded-lg border ${borderColor} shadow-lg z-10 backdrop-blur-sm transition-all duration-300 ${
        showControls ? "opacity-100" : "opacity-30"
      }`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="flex flex-col p-2 gap-2">
        <button
          className={`p-2 rounded-md ${buttonHoverColor}`}
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>

        <button
          className={`p-2 rounded-md ${buttonHoverColor}`}
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>

        <button
          className={`p-2 rounded-md ${buttonHoverColor}`}
          onClick={handleResetZoom}
          title="Reset View"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 3H3v18h18V3z"></path>
          </svg>
        </button>

        <button
          className={`p-2 rounded-md ${buttonHoverColor}`}
          onClick={applyForceLayout}
          title="Force Layout"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="4"></circle>
            <line x1="4.93" y1="4.93" x2="9.17" y2="9.17"></line>
            <line x1="14.83" y1="14.83" x2="19.07" y2="19.07"></line>
            <line x1="14.83" y1="9.17" x2="19.07" y2="4.93"></line>
            <line x1="4.93" y1="19.07" x2="9.17" y2="14.83"></line>
          </svg>
        </button>

        <button
          className={`p-2 rounded-md ${buttonHoverColor}`}
          onClick={applyCircularLayout}
          title="Circular Layout"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
        </button>

        <button
          className={`p-2 rounded-md ${buttonHoverColor}`}
          onClick={handleToggleLegend}
          title="Toggle Legend"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default GraphControls;
