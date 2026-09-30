import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

import {
  clearResearchRun,
  exportResearchLog,
  getResearchLoggerSnapshot,
  startResearchRun,
  stopResearchRun,
  subscribeResearchLogger,
} from '@/lib/research/provenanceEvents';

export default function ResearchLogPanel({
  bannerRef, collapsedZIndex, expandedZIndex, onBeforeStop,
}: {
  bannerRef: RefObject<HTMLDivElement | null>;
  collapsedZIndex: number;
  expandedZIndex: number;
  onBeforeStop?: () => void;
}) {
  const logger = useSyncExternalStore(
    subscribeResearchLogger,
    getResearchLoggerSnapshot,
    getResearchLoggerSnapshot,
  );
  const [runIdInput, setRunIdInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [bannerBottom, setBannerBottom] = useState<number | null>(null);

  useEffect(() => {
    // The banner content can grow as instructions wrap; follow its real bottom edge.
    const banner = bannerRef.current?.firstElementChild ?? bannerRef.current;
    if (!banner) return;
    const measure = () => {
      const pageTop = bannerRef.current?.parentElement?.getBoundingClientRect().top ?? 0;
      setBannerBottom(Math.max(0, banner.getBoundingClientRect().bottom - pageTop));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(banner);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [bannerRef]);

  useEffect(() => {
    if (logger.researchRunId) setRunIdInput(logger.researchRunId);
  }, [logger.researchRunId]);

  const statusLabel = logger.status === 'RECORDING'
    ? 'RECORDING'
    : logger.status === 'STOPPED' ? 'STOPPED' : 'NOT RECORDING';

  return (
    <section
      className={`absolute left-3 rounded-xl border border-slate-300 bg-white/95 text-xs text-slate-800 shadow-xl backdrop-blur-sm ${expanded ? 'w-[min(360px,calc(100vw-24px))] overflow-y-auto p-3' : 'w-auto p-0'}`}
      style={{
        top: expanded ? 'calc(env(safe-area-inset-top) + 12px)' : (bannerBottom ?? 0) + 8,
        zIndex: expanded ? expandedZIndex : collapsedZIndex,
        maxHeight: expanded ? 'calc(100dvh - env(safe-area-inset-top) - 24px)' : undefined,
        visibility: !expanded && bannerBottom === null ? 'hidden' : undefined,
      }}
    >
      {expanded ? (
        <>
          <div className="sticky top-0 z-10 mb-2 flex items-center justify-between gap-2 bg-white/95">
            <h2 className="text-sm font-bold">Research Log</h2>
            <button type="button" aria-label="Collapse Research Log" onClick={() => setExpanded(false)} className="min-h-11 min-w-11 rounded border border-slate-300 bg-white text-lg font-bold">−</button>
          </div>
          <label className="block">
            <span className="font-semibold">Run ID</span>
            <input
              value={runIdInput}
              onChange={(event) => setRunIdInput(event.target.value)}
              disabled={logger.status === 'RECORDING'}
              maxLength={200}
              placeholder="Auto-generate if blank"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 disabled:bg-slate-100"
            />
          </label>
          <dl className="my-2 grid grid-cols-2 gap-x-2 gap-y-1">
            <dt>Status</dt><dd className="font-semibold">{statusLabel}</dd>
            <dt>Events</dt><dd>{logger.eventCount}</dd>
            <dt>Dropped</dt><dd>{logger.droppedEvents}</dd>
            <dt>Clock Sync</dt><dd className="font-semibold">{logger.clockStatus.replace('_', ' ')}</dd>
            <dt>M2</dt><dd className="font-semibold">{logger.m2Incomplete || logger.droppedEvents > 0 ? 'INCOMPLETE' : 'NO KNOWN LOSS'}</dd>
          </dl>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" disabled={logger.status === 'RECORDING'} onClick={() => startResearchRun(runIdInput)} className="rounded bg-emerald-700 px-2 py-1.5 font-semibold text-white disabled:opacity-40">START LOG</button>
            <button type="button" disabled={logger.status !== 'RECORDING'} onClick={() => { onBeforeStop?.(); stopResearchRun(); }} className="rounded bg-amber-600 px-2 py-1.5 font-semibold text-white disabled:opacity-40">STOP LOG</button>
            <button type="button" disabled={!logger.hasData} onClick={exportResearchLog} className="rounded bg-blue-700 px-2 py-1.5 font-semibold text-white disabled:opacity-40">EXPORT LOG</button>
            <button type="button" disabled={logger.status === 'RECORDING'} onClick={() => { clearResearchRun(); setRunIdInput(''); }} className="rounded bg-slate-600 px-2 py-1.5 font-semibold text-white disabled:opacity-40">NEW/CLEAR RUN</button>
          </div>
        </>
      ) : (
        <button type="button" aria-label="Expand Research Log" aria-expanded={false} onClick={() => setExpanded(true)} className="min-h-11 rounded-xl px-4 font-bold">LOG</button>
      )}
    </section>
  );
}
