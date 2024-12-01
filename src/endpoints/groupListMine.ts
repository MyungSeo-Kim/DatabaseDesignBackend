import { Bool, OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { GroupWithDetails, Env } from "../types";

export class GroupListMine extends OpenAPIRoute {
    schema = {
        tags: ["Groups"],
        summary: "List my tutoring groups",
        request: {
            params: z.object({
                userId: z.string(),
            }),
        },
        responses: {
            "200": {
                description: "Returns list of my groups",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool(),
                            result: z.object({
                                groups: GroupWithDetails.array(),
                            }),
                        }),
                    },
                },
            },
        },
    };

    async handle(c) {
        const data = await this.getValidatedData<typeof this.schema>();
        const userId = parseInt(data.params.userId);

        try {
            // 사용자 역할 확인
            const user = await c.env.DB.prepare(
                `SELECT role FROM users WHERE id = ?`
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

            let groups;
            if (user.role === "teacher") {
                // 선생님인 경우 - 자신이 만든 그룹 조회
                groups = await c.env.DB.prepare(
                    `
                    SELECT 
                        g.*,
                        u.name as teacher_name,
                        (SELECT COUNT(*) FROM group_students WHERE group_id = g.id) as student_count,
                        (SELECT COUNT(*) FROM assignments WHERE group_id = g.id) as assignment_count
                    FROM tutoring_groups g
                    LEFT JOIN users u ON g.teacher_id = u.id
                    WHERE g.teacher_id = ?
                    ORDER BY g.created_at DESC
                `
                )
                    .bind(userId)
                    .all();
            } else {
                // 학생인 경우 - 자신이 참여 중인 그룹 조회
                groups = await c.env.DB.prepare(
                    `
                    SELECT 
                        g.*,
                        u.name as teacher_name,
                        (SELECT COUNT(*) FROM group_students WHERE group_id = g.id) as student_count,
                        (SELECT COUNT(*) FROM assignments WHERE group_id = g.id) as assignment_count,
                        (
                            SELECT COUNT(*) 
                            FROM assignments a
                            JOIN assignment_completions ac ON a.id = ac.assignment_id
                            WHERE a.group_id = g.id AND ac.student_id = ?
                        ) as completed_assignments
                    FROM tutoring_groups g
                    JOIN group_students gs ON g.id = gs.group_id
                    LEFT JOIN users u ON g.teacher_id = u.id
                    WHERE gs.student_id = ?
                    ORDER BY gs.joined_at DESC
                `
                )
                    .bind(userId, userId)
                    .all();
            }

            return {
                success: true,
                result: {
                    groups: groups.results.map((group) => ({
                        ...group,
                        completion_rate:
                            group.assignment_count > 0
                                ? (group.completed_assignments /
                                      group.assignment_count) *
                                  100
                                : 0,
                    })),
                },
            };
        } catch (error) {
            console.error("Error in GroupListMine:", error);
            return Response.json(
                {
                    success: false,
                    error: "Failed to fetch my groups",
                },
                { status: 500 }
            );
        }
    }
}
