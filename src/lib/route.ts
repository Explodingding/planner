export type RouteState = {
  eventId: string | null
  organizerToken: string | null
  isRemote: boolean
  isManageRoute: boolean
  staticPage: 'regulamin' | 'prywatnosc' | null
}

export function getRoute(): RouteState {
  const segments = window.location.pathname.split('/').filter(Boolean)
  const token = new URLSearchParams(window.location.search).get('token')
  const isEventRoute = segments[0] === 'event' && Boolean(segments[1])
  const isManageRoute = segments[0] === 'manage' && Boolean(segments[1])
  const staticPage =
    segments[0] === 'regulamin' ? 'regulamin' : segments[0] === 'prywatnosc' ? 'prywatnosc' : null

  return {
    eventId: isEventRoute || isManageRoute ? segments[1] : null,
    organizerToken: token,
    isRemote: isEventRoute || isManageRoute,
    isManageRoute,
    staticPage,
  }
}
