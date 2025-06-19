import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { db } from '@/db/connection'
import { products } from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { UnauthorizedError } from './errors/unauthorized-error'
//import type { JwtPayload } from '@/http/authentication'
import { zodToJsonSchema } from 'zod-to-json-schema' 

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number().min(0),
})

const bodySchema = z.object({
  products: z.object({
    newOrUpdatedProducts: z.array(productSchema),
    deletedProductIds: z.array(z.string()),
  }),
})

const bodyJsonSchema = zodToJsonSchema(bodySchema, 'BodySchema')

type Product = z.infer<typeof productSchema>
type ProductWithId = Required<Product>
type ProductWithoutId = Omit<Product, 'id'>

interface RequestWithManager extends FastifyRequest {
  getManagedRestaurantId: () => Promise<string> // user validation along with verification that the user is the owner of the restaurant
}

export async function updateMenu(app: FastifyInstance) {
  app.put(
    '/menu',
    {
      preHandler: [app.authenticate],
      schema: {
        body: bodyJsonSchema,
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (request: RequestWithManager, reply: FastifyReply) => {
      const {
        products: { newOrUpdatedProducts, deletedProductIds },
      } = request.body as z.infer<typeof bodySchema>

      const restaurantId = await request.getManagedRestaurantId()

      if (!restaurantId) {
        throw new UnauthorizedError('User is not a restaurant manager.')
      }

      if (deletedProductIds.length > 0) {
        await db.delete(products).where(
          and(
            inArray(products.id, deletedProductIds),
            eq(products.restaurantId, restaurantId)
          )
        )
      }

      const updatedProducts = newOrUpdatedProducts.filter(
        (product): product is ProductWithId => !!product.id
      )

      if (updatedProducts.length > 0) {
        await Promise.all(
          updatedProducts.map((product) =>
            db
              .update(products)
              .set({
                name: product.name,
                description: product.description,
                priceInCents: product.price * 100,
              })
              .where(
                and(
                  eq(products.id, product.id),
                  eq(products.restaurantId, restaurantId)
                )
              )
          )
        )
      }

      const newProducts = newOrUpdatedProducts.filter(
        (product): product is ProductWithoutId => !product.id
      )

      if (newProducts.length > 0) {
        await db.insert(products).values(
          newProducts.map((product) => ({
            name: product.name,
            description: product.description,
            priceInCents: product.price * 100,
            restaurantId,
          }))
        )
      }

      return reply.status(204).send()
    }
  )
}
