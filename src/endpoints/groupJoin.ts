import { Bool, OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { Env } from "../types";
import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export class GroupJoin extends OpenAPIRoute {
    schema = {
        tags: ["Groups"],
        summary: "Join a tutoring group",
        request: {
            headers: z.object({
                authorization: Str({ description: "Bearer token" }),
            }),
            params: z.object({
                groupId: z.string(),
            }),
        },
        responses: {
            "200": {
                description: "Successfully joined the group",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool(),
                            message: Str(),
                        }),
                    },
                },
            },
            "400": {
                description: "Cannot join the group",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool(),
                            error: Str(),
                        }),
                    },
                },
            },
            "403": {
                description: "Only students can join groups",
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
        const token = data.headers.authorization?.replace("Bearer ", "");
        const groupId = parseInt(data.params.groupId);

        try {
            const decoded = verify(token, JWT_SECRET) as { userId: number };

            // 사용자가 학생인지 확인
            const student = await c.env.DB.prepare(
                `
                SELECT id FROM users 
                WHERE id = ? AND role = 'student'
            `
            )
                .bind(decoded.userId)
                .first();

            if (!student) {
                return Response.json(
                    {
                        success: false,
                        error: "Only students can join groups",
                    },
                    { status: 403 }
                );
            }

            // 그룹 존재 여부 확인
            const group = await c.env.DB.prepare(
                `
                SELECT * FROM tutoring_groups WHERE id = ?
            `
            )
                .bind(groupId)
                .first();

            if (!group) {
                return Response.json(
                    {
                        success: false,
                        error: "Group not found",
                    },
                    { status: 404 }
                );
            }

            // 이미 멤버인지 확인
            const existingMember = await c.env.DB.prepare(
                `
                SELECT id FROM group_students 
                WHERE group_id = ? AND student_id = ?
            `
            )
                .bind(groupId, decoded.userId)
                .first();

            if (existingMember) {
                return Response.json(
                    {
                        success: false,
                        error: "Already a member of this group",
                    },
                    { status: 400 }
                );
            }

            // 그룹에 참여
            await c.env.DB.prepare(
                `
                INSERT INTO group_students (group_id, student_id)
                VALUES (?, ?)
            `
            )
                .bind(groupId, decoded.userId)
                .run();

            return {
                success: true,
                message: "Successfully joined the group",
            };
        } catch (error) {
            return Response.json(
                {
                    success: false,
                    error: "Failed to join group",
                },
                { status: 500 }
            );
        }
    }
}
