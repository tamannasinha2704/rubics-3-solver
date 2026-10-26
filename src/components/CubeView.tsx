import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import type { Move } from '../cube/moves';
import type { Sticker } from '../cube/types';
import { CubeRenderer } from '../three/CubeRenderer';

export interface CubeViewHandle {
  animateMove(move: Move, durationMs: number, finalColors: readonly Sticker[]): Promise<void>;
  /** Stop any animation and show these colors right away. */
  showNow(colors: readonly Sticker[]): void;
  resetView(): void;
}

interface Props {
  colors: readonly Sticker[];
  highlights?: readonly number[];
  hint?: Move | null;
  onPick?: (index: number) => void;
  /** Overlay content (e.g. orientation reminder). */
  children?: ReactNode;
  className?: string;
  label: string;
}

export const CubeView = forwardRef<CubeViewHandle, Props>(function CubeView(
  { colors, highlights, hint, onPick, children, className, label },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CubeRenderer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    if (!hostRef.current) return;
    try {
      rendererRef.current = new CubeRenderer(hostRef.current);
    } catch (e) {
      setError('Your browser could not start the 3D view (WebGL is unavailable). The flat cube views still work.');
      console.error(e);
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => rendererRef.current?.setColors(colors), [colors]);
  useEffect(() => rendererRef.current?.setHighlights(highlights ?? []), [highlights]);
  useEffect(() => rendererRef.current?.setHint(hint ?? null), [hint]);
  useEffect(() => rendererRef.current?.setShowLabels(showLabels), [showLabels]);
  useEffect(() => rendererRef.current?.setPickHandler(onPick ?? null), [onPick]);

  useImperativeHandle(
    ref,
    () => ({
      animateMove: (move, ms, finalColors) =>
        rendererRef.current ? rendererRef.current.animateMove(move, ms, finalColors) : Promise.resolve(),
      showNow: (c) => {
        rendererRef.current?.finishAnimation();
        rendererRef.current?.setColors(c);
      },
      resetView: () => rendererRef.current?.resetView(),
    }),
    [],
  );

  return (
    <div className={`cube-view ${className ?? ''}`}>
      <div ref={hostRef} className="cube-canvas" role="img" aria-label={label} />
      {error && <div className="cube-error">{error}</div>}
      <div className="cube-overlay">{children}</div>
      <div className="cube-tools">
        <button
          type="button"
          className="chip-btn"
          onClick={() => setShowLabels((s) => !s)}
          aria-pressed={showLabels}
          title="Show or hide the face letters (U, F, R…) on the centers"
        >
          {showLabels ? 'Hide letters' : 'Show letters'}
        </button>
        <button
          type="button"
          className="chip-btn"
          onClick={() => rendererRef.current?.resetView()}
          title="Return to the standard view: top face up, front face toward you"
        >
          Reset view
        </button>
      </div>
      <p className="cube-hint-text">Drag to look around{onPick ? ' · tap a square to paint it' : ''}</p>
    </div>
  );
});
