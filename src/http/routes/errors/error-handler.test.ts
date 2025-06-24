import { describe, it, expect, vi } from 'vitest'
import { errorHandler } from './error-handler'
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'

describe('errorHandler', () => {
  const mockRequest = {
    log: {
      error: vi.fn(),
    },
  } as unknown as FastifyRequest

  const createMockReply = () => {
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    }
    return reply as unknown as FastifyReply
  }

  it('should handle validation errors with 400', () => {
    const error = {
      validation: [{ message: 'Invalid input' }],
    } as FastifyError

    const reply = createMockReply()

    errorHandler(error, mockRequest, reply)

    expect(reply.status).toHaveBeenCalledWith(400)
    expect(reply.send).toHaveBeenCalledWith({
      message: 'Validation error',
      details: error.validation,
    })
  })

  it('should handle not found errors with 404', () => {
    const error = {
      code: 'FST_ERR_NOT_FOUND',
    } as FastifyError

    const reply = createMockReply()

    errorHandler(error, mockRequest, reply)

    expect(reply.status).toHaveBeenCalledWith(404)
    expect(reply.send).toHaveBeenCalledWith({
      message: 'Not Found',
    })
  })

  it('should handle internal server errors with 500', () => {
    const error = new Error('Something went wrong') as FastifyError

    const reply = createMockReply()

    errorHandler(error, mockRequest, reply)

    expect(mockRequest.log.error).toHaveBeenCalledWith(error)
    expect(reply.status).toHaveBeenCalledWith(500)
    expect(reply.send).toHaveBeenCalledWith({
      message: 'Internal Server Error',
    })
  })
})
