import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // Se o erro for de validação
  if ((error as any).validation) {
    reply.status(400).send({
      message: 'Validation error',
      details: (error as any).validation,
    })
    return
  }

  // Se for rota não encontrada
  if ((error as any).code === 'FST_ERR_NOT_FOUND') {
    reply.status(404).send({ message: 'Not Found' })
    return
  }

  // Outros erros internos
  request.log.error(error)
  reply.status(500).send({ message: 'Internal Server Error' })
}
