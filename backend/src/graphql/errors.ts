import { ApolloError } from 'apollo-server-express';
import { AppError, isAppError } from '../domain/errors';

export interface GraphQLContext {
  userId: string | null;
}

export function requireUser(ctx: GraphQLContext): string {
  if (!ctx.userId) {
    throw new AppError('UNAUTHENTICATED', 'Authentication required');
  }
  return ctx.userId;
}

export function toGraphQLError(e: unknown): ApolloError {
  if (e instanceof ApolloError) return e;
  if (isAppError(e)) return new ApolloError(e.message, e.code, e.details);
  return new ApolloError('Something went wrong', 'INTERNAL');
}

// Wraps a resolver so every thrown error keeps its code (no generic re-throws).
export function resolver<A, R>(fn: (args: A, ctx: GraphQLContext) => Promise<R> | R) {
  return async (_parent: unknown, args: A, ctx: GraphQLContext): Promise<R> => {
    try {
      return await fn(args, ctx);
    } catch (e) {
      throw toGraphQLError(e);
    }
  };
}
