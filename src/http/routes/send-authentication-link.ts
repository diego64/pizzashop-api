import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
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

interface RequestWithBody extends FastifyRequest {
  body: z.infer<typeof bodySchema>
}

export async function sendAuthenticationLink(app: FastifyInstance) {
  app.post('/authenticate', {
    schema: {
      body: bodySchema,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.body as { email: string }

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
  })
}
