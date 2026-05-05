import { getStore } from '@netlify/blobs'
import type {
  EventDetails,
  EventRecord,
  Gift,
  PlannerState,
  PublicEventRecord,
  Reservation,
  ReservationStatus,
  Rsvp,
} from '../../src/types'

type Action =
  | 'create'
  | 'updateEvent'
  | 'addGift'
  | 'reserveGift'
  | 'submitRsvp'
  | 'updateReservationStatus'

type ActionRequest = {
  action: Action
  id?: string
  token?: string
  planner?: PlannerState
  event?: EventDetails
  gift?: Omit<Gift, 'id'>
  reservation?: Omit<Reservation, 'id' | 'status' | 'createdAt'>
  rsvp?: Omit<Rsvp, 'id' | 'updatedAt'>
  reservationId?: string
  status?: ReservationStatus
}

const STORE_NAME = 'planner-events'

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  })
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function createEventSlug(childName?: string) {
  const normalized = (childName || 'event')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)

  return `${normalized || 'event'}-${crypto.randomUUID().slice(0, 8)}`
}

function getStoreKey(id: string) {
  return `events/${id}`
}

function getOrigin(req: Request) {
  return new URL(req.url).origin
}

function stripPrivateData(record: EventRecord, req: Request, canManage: boolean): PublicEventRecord {
  const origin = getOrigin(req)
  const publicUrl = `${origin}/event/${record.id}`
  const manageUrl = canManage
    ? `${origin}/manage/${record.id}?token=${record.organizerToken}`
    : undefined

  if (canManage) {
    return {
      id: record.id,
      planner: record.planner,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      canManage,
      publicUrl,
      manageUrl,
    }
  }

  return {
    id: record.id,
    planner: {
      ...record.planner,
      reservations: record.planner.reservations.map((reservation) => ({
        ...reservation,
        contact: '',
      })),
      rsvps: record.planner.rsvps.map((rsvp) => ({
        ...rsvp,
        contact: '',
        note: '',
      })),
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    canManage,
    publicUrl,
  }
}

async function readRecord(id: string) {
  const store = getStore(STORE_NAME)
  const record = await store.get(getStoreKey(id), {
    consistency: 'strong',
    type: 'json',
  })

  return record as EventRecord | null
}

async function writeRecord(record: EventRecord) {
  const store = getStore(STORE_NAME)
  await store.setJSON(getStoreKey(record.id), record)
}

async function requireManagedRecord(id: string | undefined, token: string | undefined) {
  if (!id || !token) {
    return { error: json({ error: 'Missing event id or organizer token' }, { status: 400 }) }
  }

  const record = await readRecord(id)
  if (!record) {
    return { error: json({ error: 'Event not found' }, { status: 404 }) }
  }

  if (record.organizerToken !== token) {
    return { error: json({ error: 'Invalid organizer token' }, { status: 403 }) }
  }

  return { record }
}

async function handleGet(req: Request) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const token = url.searchParams.get('token') ?? undefined

  if (!id) {
    return json({ error: 'Missing event id' }, { status: 400 })
  }

  const record = await readRecord(id)
  if (!record) {
    return json({ error: 'Event not found' }, { status: 404 })
  }

  return json({
    event: stripPrivateData(record, req, token === record.organizerToken),
  })
}

async function handleCreate(req: Request, body: ActionRequest) {
  if (!body.planner) {
    return json({ error: 'Missing planner payload' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const id = createEventSlug(body.planner.event.childName)
  const record: EventRecord = {
    id,
    organizerToken: crypto.randomUUID(),
    planner: body.planner,
    createdAt: now,
    updatedAt: now,
  }

  await writeRecord(record)

  return json({
    event: stripPrivateData(record, req, true),
  })
}

async function handlePost(req: Request) {
  const body = (await req.json()) as ActionRequest

  if (body.action === 'create') {
    return handleCreate(req, body)
  }

  if (body.action === 'reserveGift') {
    if (!body.id || !body.reservation) {
      return json({ error: 'Missing reservation payload' }, { status: 400 })
    }

    const record = await readRecord(body.id)
    if (!record) return json({ error: 'Event not found' }, { status: 404 })

    const reservation: Reservation = {
      ...body.reservation,
      id: createId('reservation'),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    record.planner.reservations = [...record.planner.reservations, reservation]
    record.updatedAt = new Date().toISOString()
    await writeRecord(record)

    return json({ event: stripPrivateData(record, req, false) })
  }

  if (body.action === 'submitRsvp') {
    if (!body.id || !body.rsvp) {
      return json({ error: 'Missing RSVP payload' }, { status: 400 })
    }

    const record = await readRecord(body.id)
    if (!record) return json({ error: 'Event not found' }, { status: 404 })

    const existing = record.planner.rsvps.find((rsvp) => rsvp.contact === body.rsvp?.contact)
    const rsvp: Rsvp = {
      ...body.rsvp,
      id: existing?.id ?? createId('rsvp'),
      updatedAt: new Date().toISOString(),
    }

    record.planner.rsvps = existing
      ? record.planner.rsvps.map((item) => (item.id === existing.id ? rsvp : item))
      : [...record.planner.rsvps, rsvp]
    record.updatedAt = new Date().toISOString()
    await writeRecord(record)

    return json({ event: stripPrivateData(record, req, false) })
  }

  const managed = await requireManagedRecord(body.id, body.token)
  if (managed.error) return managed.error

  const record = managed.record
  if (!record) return json({ error: 'Event not found' }, { status: 404 })

  if (body.action === 'updateEvent') {
    if (!body.event) return json({ error: 'Missing event payload' }, { status: 400 })
    record.planner.event = body.event
  }

  if (body.action === 'addGift') {
    if (!body.gift) return json({ error: 'Missing gift payload' }, { status: 400 })
    record.planner.gifts = [
      ...record.planner.gifts,
      {
        ...body.gift,
        id: createId('gift'),
      },
    ]
  }

  if (body.action === 'updateReservationStatus') {
    if (!body.reservationId || !body.status) {
      return json({ error: 'Missing reservation status payload' }, { status: 400 })
    }

    const target = record.planner.reservations.find(
      (reservation) => reservation.id === body.reservationId,
    )

    record.planner.reservations = record.planner.reservations.map((reservation) => {
      if (reservation.id === body.reservationId) {
        return { ...reservation, status: body.status as ReservationStatus }
      }

      if (
        body.status === 'approved' &&
        target &&
        reservation.giftId === target.giftId &&
        reservation.status === 'pending'
      ) {
        return { ...reservation, status: 'rejected' }
      }

      return reservation
    })
  }

  record.updatedAt = new Date().toISOString()
  await writeRecord(record)

  return json({ event: stripPrivateData(record, req, true) })
}

export default async (req: Request) => {
  try {
    if (req.method === 'GET') return handleGet(req)
    if (req.method === 'POST') return handlePost(req)

    return json({ error: 'Method not allowed' }, { status: 405 })
  } catch (error) {
    console.error(error)
    return json({ error: 'Unexpected server error' }, { status: 500 })
  }
}
