import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { db } from '@/db/connection'
import { authLinks } from '@/db/schema'
import { createId } from '@paralleldrive/cuid2'
// import { resend } from '@/mail/client'
// import { AuthenticationMagicLinkTemplate } from '@/mail/templates/authentication-magic-link'
import { env } from '@/env'
import { UnauthorizedError } from './errors/unauthorized-error'

const bodySchema = z.object({
  email: z.string().email(),
})

export async function sendAuthenticationLink(app: FastifyInstance) {
  app.post(
    '/authenticate',
    {
      schema: {
        body: zodToJsonSchema(bodySchema, 'bodySchema'),
      },
    },
    async (request, reply) => {
      try {
        const { email } = bodySchema.parse(request.body)

        const userFromEmail = await db.query.users.findFirst({
          where(fields, { eq }) {
            return eq(fields.email, email)
          },
        })

        if (!userFromEmail) {
          throw new UnauthorizedError()
        }

        const authLinkCode = createId()

        await db.insert(authLinks).values({
          userId: userFromEmail.id,
          code: authLinkCode,
        })

        const authLink = new URL('/auth-links/authenticate', env.API_BASE_URL)
        authLink.searchParams.set('code', authLinkCode)
        authLink.searchParams.set('redirect', env.AUTH_REDIRECT_URL)

        console.log(authLink.toString())

          // await resend.emails.send({
          //   from: 'Pizza Shop <naoresponda@pizzashop.com>',
          //   to: email,
          //   subject: '[Pizza Shop] Link para login',
          //   react: AuthenticationMagicLinkTemplate({
          //     userEmail: email,
          //     authLink: authLink.toString(),
          //   }),
          // })

        reply.status(204).send()
      } catch (error: any) {
        if (error instanceof UnauthorizedError) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'You are not authorized to access this resource.',
          })
        }
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            error: 'Bad Request',
            message: error.errors.map((e: any) => e.message).join(', '),
          })
        }
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: error.message || 'Unknown error',
        })
      }
    }
  )
}