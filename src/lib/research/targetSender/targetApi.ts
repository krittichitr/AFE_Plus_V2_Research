import type {
  SendTargetLocationInput,
  TargetSafezone,
  TargetSenderIdentity,
} from './types';

type ApiEnvelope = {
  message?: unknown;
  data?: unknown;
};

export class TargetSenderApiError extends Error {
  constructor(message: string, public readonly status: number | null = null) {
    super(message);
    this.name = 'TargetSenderApiError';
  }
}

async function readJson(response: Response): Promise<ApiEnvelope> {
  try {
    return await response.json() as ApiEnvelope;
  } catch {
    return {};
  }
}

function numberField(value: unknown, name: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new TargetSenderApiError(`ข้อมูล Safe Zone ไม่ถูกต้อง (${name})`);
  }
  return parsed;
}

export async function fetchTargetSafezone(
  identity: TargetSenderIdentity,
  signal?: AbortSignal,
): Promise<TargetSafezone> {
  const query = new URLSearchParams({
    users_id: String(identity.usersId),
    takecare_id: String(identity.takecareId),
  });
  const response = await fetch(`/api/setting/getSafezone?${query.toString()}`, { signal });
  const body = await readJson(response);

  if (!response.ok || body.message !== 'success' || !body.data || typeof body.data !== 'object') {
    throw new TargetSenderApiError('ไม่พบ Safe Zone สำหรับผู้ใช้งานนี้', response.status);
  }

  const row = body.data as Record<string, unknown>;
  const latitude = numberField(row.safez_latitude, 'latitude');
  const longitude = numberField(row.safez_longitude, 'longitude');

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new TargetSenderApiError('พิกัด Safe Zone อยู่นอกช่วงที่ถูกต้อง');
  }

  return { latitude, longitude };
}

export async function sendTargetLocation(input: SendTargetLocationInput): Promise<void> {
  const response = await fetch('/api/sentlocation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: input.signal,
    body: JSON.stringify({
      uId: input.identity.usersId,
      takecare_id: input.identity.takecareId,
      distance: input.distanceFromSafezoneM,
      latitude: input.sample.latitude,
      longitude: input.sample.longitude,
      target_sample_id: input.sample.targetSampleId,
      battery: input.batteryPercent,
    }),
  });
  const body = await readJson(response);

  if (!response.ok || body.message !== 'success') {
    const detail = typeof body.data === 'string' ? `: ${body.data}` : '';
    throw new TargetSenderApiError(`ส่งตำแหน่งไม่สำเร็จ${detail}`, response.status);
  }
}
