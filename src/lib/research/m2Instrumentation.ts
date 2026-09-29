import {
  appendResearchProvenanceEvent,
  appendResearchProvenanceEventAt,
  getRecordingResearchRunId,
  markM2Incomplete,
} from './provenanceEvents';

export function m2ResearchFetchBlocked(search: string, runId: string | null): boolean {
  return new URLSearchParams(search).get('m2_research') === '1' && !runId;
}

export function startV2M2Attempt(input: {
  sessionId: string;
  routeUpdateId: string;
  updateType: 'initial' | 'normal' | 'style_reload';
  targetSampleId: string | null;
}): string | null {
  if (!getRecordingResearchRunId()) return null;
  const dispatchMonoMs = performance.now();
  const dispatchWallClockMs = Date.now();
  const attemptId = crypto.randomUUID();
  if (!appendResearchProvenanceEventAt({
    event: 'm2_mapbox_attempt', session_id: input.sessionId,
    route_update_id: input.routeUpdateId, mapbox_attempt_id: attemptId,
    request_phase: input.updateType === 'initial' ? 'initial' : 'navigation',
    request_purpose: 'corridor_driving',
    operation: input.updateType === 'initial' ? 'initial_route' : 'route_update',
    update_type: input.updateType, target_sample_id: input.targetSampleId,
    dispatch_wall_clock_ms: dispatchWallClockMs, dispatch_mono_ms: dispatchMonoMs,
    clock_domain: 'browser_performance', attempt_index: 1,
  }, dispatchMonoMs)) markM2Incomplete('attempt_event_dropped');
  return attemptId;
}

export function finishV2M2Attempt(
  attemptId: string | null,
  success: boolean,
  httpStatus: number | null,
  failureReason: string | null,
): void {
  if (!attemptId) return;
  if (!appendResearchProvenanceEvent({
    event: 'm2_mapbox_outcome', mapbox_attempt_id: attemptId,
    success, http_status: httpStatus, failure_reason: failureReason,
  })) markM2Incomplete('outcome_event_dropped');
}
