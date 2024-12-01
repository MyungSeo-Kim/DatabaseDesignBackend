import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { User, UserResponse, Env } from "../types";
import { hash } from "bcryptjs";

export class UserRegister extends OpenAPIRoute {
    schema = {
        tags: ["Users"],
        summary: "Register a new user",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: User.omit({
                            created_at: true,
                            updated_at: true,
                        }),
                    },
                },
            },
        },
        responses: {
            "201": {
                description: "User successfully registered",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool(),
                            result: z.object({
                                user: UserResponse,
                            }),
                        }),
                    },
                },
            },
            "400": {
                description: "Email or username already exists",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool(),
                            error: z.string(),
                        }),
                    },
                },
            },
        },
    };

    async handle(c) {
        const data = await this.getValidatedData<typeof this.schema>();
        const { email, username, password, name, role } = data.body;

        try {
            // 비밀번호 해싱
            const hashedPassword = await hash(password, 10);

            // 사용자 생성 (role 필드 추가)
            const result = await c.env.DB.prepare(
                `
                INSERT INTO users (email, username, password, name, role)
                VALUES (?, ?, ?, ?, ?)
                RETURNING email, username, name, role, created_at, updated_at
            `
            )
                .bind(email, username, hashedPassword, name, role)
                .first();

            if (!result) {
                return Response.json(
                    {
                        success: false,
                        error: "Failed to create user",
                    },
                    { status: 400 }
                );
            }

            return {
                success: true,
                result: {
                    user: result,
                },
            };
        } catch (error) {
            // 중복 이메일/사용자명 체크
            if (error.message.includes("UNIQUE constraint failed")) {
                return Response.json(
                    {
                        success: false,
                        error: "Email or username already exists",
                    },
                    { status: 400 }
                );
            }

            return Response.json(
                {
                    success: false,
                    error: "Internal server error",
                },
                { status: 500 }
            );
        }
    }
}
