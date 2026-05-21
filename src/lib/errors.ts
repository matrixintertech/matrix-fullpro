import { NextResponse } from "next/server";

export class ApiError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        code: error.code,
        message: error.message,
      },
      { status: error.statusCode }
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected error";

  if (message.includes("Environment variable not found: DATABASE_URL")) {
    return NextResponse.json(
      {
        success: false,
        code: "DATABASE_URL_MISSING",
        message: "DATABASE_URL is missing. Set it in frontend/.env.local.",
      },
      { status: 500 }
    );
  }

  if (message.includes("provided database string is invalid")) {
    return NextResponse.json(
      {
        success: false,
        code: "DATABASE_URL_INVALID",
        message: "DATABASE_URL is invalid. Use a valid PostgreSQL connection string.",
      },
      { status: 500 }
    );
  }

  if (
    message.includes("does not exist on the database server") ||
    message.includes("Can't reach database server")
  ) {
    return NextResponse.json(
      {
        success: false,
        code: "DATABASE_CONNECTION_FAILED",
        message: "Could not connect to PostgreSQL. Verify Neon/local DB and DATABASE_URL.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      code: "INTERNAL_ERROR",
      message,
    },
    { status: 500 }
  );
}
