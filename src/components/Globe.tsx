import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import createGlobe from "cobe";
import type { COBEOptions } from "cobe";
import { useDisasterStore } from '../store/disaster';

type GlobeRenderState = Parameters<NonNullable<COBEOptions['onRender']>>[0];

const defaultConfig: COBEOptions = {
  width: 1000,
  height: 1000,
  onRender: () => {},
  devicePixelRatio: 1.25,
  phi: 0,
  theta: 0.3,
  dark: 1,
  diffuse: 1.2,
  mapSamples: 6000,
  mapBrightness: 4,
  baseColor: [0.3, 0.3, 0.6],
  markerColor: [0.9, 0.4, 0.3],
  glowColor: [0.8, 0.3, 0],
  markers: [],
  opacity: 0.9,
};

export function Globe({
  className = "",
  config = defaultConfig,
}: {
  className?: string;
  config?: COBEOptions;
}) {
  const disasters = useDisasterStore((state) => state.disasters);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [canvasSize, setCanvasSize] = useState(0);

  // Convert disasters to markers with proper scaling and colors
  const markers = useMemo(
    () =>
      disasters
        .filter(disaster => disaster.location?.coordinates)
        .map(disaster => ({
          location: [disaster.location.coordinates[1], disaster.location.coordinates[0]] as [number, number], // Swap lat/lng for COBE
          size: Math.max(0.5, Math.min(1.5, disaster.severity * 0.3)), // Scale marker size based on severity
          color: getDisasterColor(disaster.type),
        })),
    [disasters]
  );

  function getDisasterColor(type: string): [number, number, number] {
    switch (type) {
      case 'earthquake':
        return [1, 0.3, 0.2]; // Red
      case 'flood':
        return [0.2, 0.4, 1]; // Blue
      case 'hurricane':
        return [0.8, 0.8, 0.2]; // Yellow
      case 'tornado':
        return [0.6, 0.2, 0.8]; // Purple
      case 'wildfire':
        return [1, 0.5, 0]; // Orange
      case 'tsunami':
        return [0, 0.7, 0.9]; // Cyan
      default:
        return [1, 1, 1]; // White
    }
  }

  const updatePointerInteraction = (value: number | null) => {
    pointerInteracting.current = value;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = value !== null ? "grabbing" : "grab";
    }
  };

  const updateMovement = (clientX: number) => {
    if (pointerInteracting.current !== null) {
      const delta = clientX - pointerInteracting.current;
      pointerInteractionMovement.current = delta;
      setRotation(delta / 200);
    }
  };

  const onResize = () => {
    if (canvasRef.current) {
      setCanvasSize(canvasRef.current.offsetWidth);
    }
  };

  const onRender = useCallback(
    (state: GlobeRenderState) => {
      if (pointerInteracting.current === null) {
        phiRef.current += 0.005;
      }
      state.phi = phiRef.current + rotation;
      state.width = canvasSize * 2;
      state.height = canvasSize * 2;
    },
    [canvasSize, rotation],
  );

  useEffect(() => {
    if (!canvasRef.current) return;

    window.addEventListener("resize", onResize);
    onResize();

    const globeConfig = {
      ...defaultConfig,
      ...config,
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, defaultConfig.devicePixelRatio || 1.25),
      width: canvasSize * 2,
      height: canvasSize * 2,
      onRender,
      markers,
    };

    const globe = createGlobe(canvasRef.current, globeConfig);
    const loadingTimer = window.setTimeout(() => {
      if (canvasRef.current) {
        canvasRef.current.style.opacity = "1";
        setIsLoading(false);
      }
    }, 500);

    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(loadingTimer);
      globe.destroy();
    };
  }, [canvasSize, config, disasters, markers, onRender]);

  return (
    <div className={`relative w-full h-full flex items-center justify-center ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="h-full w-full opacity-0 transition-opacity duration-500"
        style={{ 
          contain: "layout paint size",
          cursor: "grab"
        }}
        onPointerDown={(e) =>
          updatePointerInteraction(e.clientX - pointerInteractionMovement.current)
        }
        onPointerUp={() => updatePointerInteraction(null)}
        onPointerOut={() => updatePointerInteraction(null)}
        onMouseMove={(e) => updateMovement(e.clientX)}
        onTouchMove={(e) =>
          e.touches[0] && updateMovement(e.touches[0].clientX)
        }
      />
      <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-sm rounded-lg p-3">
        <div className="text-xs text-white space-y-2">
          <div className="font-semibold mb-2">Disaster Types</div>
          {['earthquake', 'flood', 'hurricane', 'tornado', 'wildfire', 'tsunami'].map(type => (
            <div key={type} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ 
                  backgroundColor: `rgb(${getDisasterColor(type).map(c => c * 255).join(',')})` 
                }}
              />
              <span className="capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
