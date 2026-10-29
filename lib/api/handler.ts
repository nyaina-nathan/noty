import type { NextRequest } from "next/server";
import { ApiError } from "./errors";

export type ApiHandler<TContext = unknown> = (
  request: NextRequest,
  context: TContext,
) => Response | Promise<Response>;

export function withApiErrorHandling<TContext = unknown>(
  handler: ApiHandler<TContext>,
): ApiHandler<TContext> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        return Response.json(error.toJSON(), { status: error.status });
      }

      console.error(error);

      const internal = ApiError.internal();
      return Response.json(internal.toJSON(), { status: internal.status });
    }
  };
}
