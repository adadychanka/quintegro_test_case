import { ApolloServer } from 'apollo-server-express';
import { typeDefs } from './schema';
import { createResolvers } from './resolvers';
import { Container } from '../container';
import { GraphQLContext } from './errors';

export const createApolloServer = (container: Container) => {
  const resolvers = createResolvers(container);
  const { auth } = container.services;

  return new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }): GraphQLContext => {
      const header = req.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) return { userId: null };
      const decoded = auth.verifyToken(header.substring(7));
      return { userId: decoded?.userId ?? null };
    },
    formatError: (error) => {
      const { exception, ...extensions } = (error.extensions ?? {}) as Record<string, unknown>;
      const code = (extensions.code as string) ?? 'INTERNAL';
      // Log only the code and path: never variables (addresses, phones, tokens).
      console.error(`GraphQL error code=${code} path=${(error.path ?? []).join('.')}`);
      return {
        message: error.message,
        path: error.path,
        extensions: { ...extensions, code },
      };
    },
    introspection: true,
  });
};
