import { Bool, OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { UserResponse, Env } from "../types";

export class UserProfile extends OpenAPIRoute {
    schema = {
        tags: ["Users"],
        summary: "Get user profile by ID",
        request: {
            params: z.object({
                id: z.string().transform((val) => parseInt(val, 10)),
            }),
        },
        responses: {
            "200": {
                description: "Returns user profile",
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
            "404": {
                description: "User not found",
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
        const userId = data.params.id;

        // 사용자 정보 조회
        const user = await c.env.DB.prepare(
            `
            SELECT email, username, name, role, created_at, updated_at
            FROM users WHERE id = ?
        `
        )
            .bind(userId)
            .first();

        if (!user) {
            return Response.json(
                {
                    success: false,
                    error: "User not found",
                },
                { status: 404 }
            );
        }

        return {
            success: true,
            result: {
                user,
            },
        };
    }
}
