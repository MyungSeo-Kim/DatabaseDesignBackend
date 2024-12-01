import { Bool, OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { UserResponse, Env } from "../types";
import { compare } from "bcryptjs";
import { sign } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export class UserLogin extends OpenAPIRoute {
    schema = {
        tags: ["Users"],
        summary: "User login",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: z.object({
                            email: Str({ example: "user@example.com" }),
                            password: Str({ example: "password123" }),
                        }),
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Login successful",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool(),
                            result: z.object({
                                user: UserResponse,
                                user_id: z.number(),
                                role: Str(),
                            }),
                        }),
                    },
                },
            },
            "401": {
                description: "Invalid credentials",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool(),
                            error: Str(),
                        }),
                    },
                },
            },
        },
    };

    async handle(c) {
        const data = await this.getValidatedData<typeof this.schema>();
        const { email, password } = data.body;

        try {
            // 사용자 조회
            const user = await c.env.DB.prepare(
                `
                SELECT id, email, username, password, name, role, created_at, updated_at
                FROM users WHERE email = ?
            `
            )
                .bind(email)
                .first();

            if (!user) {
                return Response.json(
                    {
                        success: false,
                        error: "Invalid credentials",
                    },
                    { status: 401 }
                );
            }

            // 비밀번호 검증
            const isValid = await compare(password, user.password);
            if (!isValid) {
                return Response.json(
                    {
                        success: false,
                        error: "Invalid credentials",
                    },
                    { status: 401 }
                );
            }

            const { password: _, ...userWithoutPassword } = user;

            return {
                success: true,
                result: {
                    user: userWithoutPassword,
                    user_id: user.id,
                    role: user.role,
                },
            };
        } catch (error) {
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
