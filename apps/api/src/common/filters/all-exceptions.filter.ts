import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";

function toMessage(x: any): string {
  if (!x) return "Request failed";
  if (typeof x === "string") return x;
  if (Array.isArray(x)) return x.map((v) => String(v)).filter(Boolean).join(", ") || "Request failed";
  if (typeof x?.message === "string") return x.message;
  if (Array.isArray(x?.message)) return x.message.map((v: any) => String(v)).filter(Boolean).join(", ") || "Request failed";
  return "Request failed";
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = "Internal Server Error";
    let message = "Internal server error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload: any = exception.getResponse();
      message = toMessage(payload);
      error = typeof payload === "object" && payload?.error ? String(payload.error) : exception.name;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Avoid leaking DB details while keeping UX reasonable.
      if (exception.code === "P2002") {
        status = HttpStatus.CONFLICT;
        error = "Conflict";
        message = "Already exists";
      } else if (exception.code === "P2025") {
        status = HttpStatus.NOT_FOUND;
        error = "Not Found";
        message = "Not found";
      } else {
        status = HttpStatus.BAD_REQUEST;
        error = "Bad Request";
        message = "Invalid request";
      }
    } else if (exception?.name === "SyntaxError" && String(exception?.message ?? "").includes("JSON")) {
      status = HttpStatus.BAD_REQUEST;
      error = "Bad Request";
      message = "Invalid JSON payload";
    }

    res.status(status).json({
      statusCode: status,
      error,
      message,
      path: req?.originalUrl ?? req?.url ?? null,
    });
  }
}

