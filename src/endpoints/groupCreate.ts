import { Bool, OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { TutoringGroup, Env } from "../types";

export class GroupCreate extends OpenAPIRoute {
    schema = {
        tags: ["Groups"],
        summary: "Create a new tutoring group",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: z.object({
                            name: Str(),
                            description: Str(),
                            user_id: z.number(),
                        }),
                    },
                },
            },
        },
        responses: {
            "201": {
                description: "Group successfully created",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool(),
                            result: z.object({
                                group: TutoringGroup,
                            }),
                        }),
                    },
                },
            },
            "403": {
                description: "Only teachers can create groups",
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
        const { name, description, user_id } = data.body;

        try {
            // 사용자가 선생님인지 확인
            const teacher = await c.env.DB.prepare(
                `
                SELECT id FROM users 
                WHERE id = ? AND role = 'teacher'
            `
            )
                .bind(user_id)
                .first();

            if (!teacher) {
                return Response.json(
                    {
                        success: false,
                        error: "Only teachers can create groups",
                    },
                    { status: 403 }
                );
            }

            // 그룹 생성
            const result = await c.env.DB.prepare(
                `
                INSERT INTO tutoring_groups (name, description, teacher_id)
                VALUES (?, ?, ?)
                RETURNING *
            `
            )
                .bind(name, description, user_id)
                .first();

            return {
                success: true,
                result: {
                    group: result,
                },
            };
        } catch (error) {
            return Response.json(
                {
                    success: false,
                    error: "Failed to create group",
                },
                { status: 500 }
            );
        }
    }
}
