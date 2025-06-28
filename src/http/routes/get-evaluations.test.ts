import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fastify, FastifyInstance } from 'fastify'
import { getEvaluations } from './get-evaluations'
import { db } from '@/db/connection'

vi.mock('@/db/connection', () => ({
  db: {
    query: {
      evaluations: {
        findMany: vi.fn(),
      },
    },
  },
}))

describe('getEvaluations route', () => {
  let app: FastifyInstance
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    app = fastify()

    app.decorate('authenticate', async () => {})

    app.decorateRequest('getCurrentUser', function () {
      return Promise.resolve({ sub: 'test-user', restaurantId: 'rest-1' })
    })

    await getEvaluations(app)
    await app.ready()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await app.close()

    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('should return 401 if user has no restaurantId', async () => {
    app = fastify()

    app.decorate('authenticate', async () => {})

    app.decorateRequest('getCurrentUser', function () {
      return Promise.resolve({ sub: 'test-user' }) // sem restaurantId
    })

    await getEvaluations(app)
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/evaluations',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual({ error: 'User is not a restaurant manager.' })
  })

  it('should return evaluations with default pageIndex=0', async () => {
    const fakeEvaluations = [
      {
        id: 'eval-1',
        createdAt: new Date(),
        customerId: 'cust-1',
        restaurantId: 'rest-1',
        rate: 5,
        comment: 'Great!',
      },
      {
        id: 'eval-2',
        createdAt: new Date(),
        customerId: 'cust-2',
        restaurantId: 'rest-1',
        rate: 4,
        comment: 'Good!',
      },
    ]

    vi.mocked(db.query.evaluations.findMany).mockResolvedValue(fakeEvaluations)

    const response = await app.inject({
      method: 'GET',
      url: '/evaluations',
    })

    expect(db.query.evaluations.findMany).toHaveBeenCalled()

    const callArg = vi.mocked(db.query.evaluations.findMany).mock.calls[0]?.[0]
    expect(callArg).toBeDefined()
    expect(callArg?.offset).toBe(0)
    expect(callArg?.limit).toBe(10)
    expect(typeof callArg?.orderBy).toBe('function')
    expect(typeof callArg?.where).toBe('function')

    expect(response.statusCode).toBe(200)

    const responseData = response.json().map((evaluation: any) => ({
      ...evaluation,
      createdAt: new Date(evaluation.createdAt),
    }))

    expect(responseData).toEqual(fakeEvaluations)
  })

  it('should return evaluations for a specific pageIndex', async () => {
    const fakeEvaluations = [
      {
        id: 'eval-4',
        createdAt: new Date(),
        customerId: 'cust-4',
        restaurantId: 'rest-1',
        rate: 2,
        comment: 'Could be better',
      },
    ]

    vi.mocked(db.query.evaluations.findMany).mockResolvedValue(fakeEvaluations)

    const response = await app.inject({
      method: 'GET',
      url: '/evaluations?pageIndex=2',
    })

    expect(db.query.evaluations.findMany).toHaveBeenCalled()

    const callArg = vi.mocked(db.query.evaluations.findMany).mock.calls[0]?.[0]
    expect(callArg?.offset).toBe(20)
    expect(callArg?.limit).toBe(10)

    expect(response.statusCode).toBe(200)

    const responseData = response.json().map((evaluation: any) => ({
      ...evaluation,
      createdAt: new Date(evaluation.createdAt),
    }))

    expect(responseData).toEqual(fakeEvaluations)
  })

  it('should coerce invalid pageIndex query param to default (0)', async () => {
    const fakeEvaluations = [
      {
        id: 'eval-5',
        createdAt: new Date(),
        customerId: 'cust-5',
        restaurantId: 'rest-1',
        rate: 3,
        comment: 'Average',
      },
    ]

    vi.mocked(db.query.evaluations.findMany).mockResolvedValue(fakeEvaluations)

    const response = await app.inject({
      method: 'GET',
      url: '/evaluations?pageIndex=invalid',
    })

    const callArg = vi.mocked(db.query.evaluations.findMany).mock.calls[0]?.[0]

    expect(callArg?.offset).toBe(0)
    expect(callArg?.limit).toBe(10)

    expect(response.statusCode).toBe(200)

    const responseData = response.json().map((evaluation: any) => ({
      ...evaluation,
      createdAt: new Date(evaluation.createdAt),
    }))

    expect(responseData).toEqual(fakeEvaluations)
  })
})
