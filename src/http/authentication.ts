import { Elysia, t, type Static } from 'elysia'
import { cookie } from '@elysiajs/cookie'
import jwt from '@elysiajs/jwt'
import { env } from '@/env'
import { UnauthorizedError } from './routes/errors/unauthorized-error'
import { NotAManagerError } from './routes/errors/not-a-manager-error'

const jwtPayloadSchema = t.Object({
  sub: t.String(),
  restaurantId: t.Optional(t.String()),
})

export const authentication = new Elysia()
  .error({
    UNAUTHORIZED: UnauthorizedError,
    NOT_A_MANAGER: NotAManagerError,
  })
  .onError(({ code, error, set }) => {
    if (code === 'UNAUTHORIZED' || code === 'NOT_A_MANAGER') {
      set.status = 401
      return { code, message: error.message }
    }

    set.status = 500
    return { code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected error' }
  })
  .use(
    jwt({
      name: 'jwt',
      secret: env.JWT_SECRET_KEY,
      schema: jwtPayloadSchema,
    })
  )
  .use(cookie())
  .derive((ctx: any) => {
  const { jwt, cookie, setCookie, removeCookie } = ctx

  return {
    getCurrentUser: async () => {
      const payload = await jwt.verify(cookie.auth)
      if (!payload) throw new UnauthorizedError()
      return payload
    },
    signUser: async (payload: Static<typeof jwtPayloadSchema>) => {
      setCookie('auth', await jwt.sign(payload), {
        httpOnly: true,
        maxAge: 7 * 86400, // 7 days
        path: '/',
      })
    },
    signOut: () => {
      removeCookie('auth')
    },
  }
})
  .derive((ctx: any) => {
  const { getCurrentUser } = ctx

  return {
    getManagedRestaurantId: async () => {
      const { restaurantId } = await getCurrentUser()
      if (!restaurantId) throw new NotAManagerError()
      return restaurantId
    },
  }
})