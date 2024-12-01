import { Bool, Num, OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { GroupWithDetails, Env } from "../types";

export class GroupList extends OpenAPIRoute {
    schema = {
        tags: ["Groups"],
        summary: "List tutoring groups",
        request: {
            query: z.object({
                page: Num({ description: "Page number", default: 0 }),
                limit: Num({ description: "Items per page", default: 10 }),
                search: Str({ description: "Search term", required: false }),
                user_id: Num({ description: "User ID", required: false }),
            }),
        },
        responses: {
            "200": {
                description: "Returns list of groups",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool(),
                            result: z.object({
                                groups: GroupWithDetails.array(),
                                total: z.number(),
                            }),
                        }),
                    },
                },
            },
        },
    };

    async handle(c) {
        const data = await this.getValidatedData<typeof this.schema>();
        const { page, limit, search, user_id } = data.query;
        const offset = page * limit;

        try {
            let query;
            const params = [];

            if (user_id) {
                // 사용자 역할 확인
                const user = await c.env.DB.prepare(
                    `SELECT role FROM users WHERE id = ?`
                )
                    .bind(user_id)
                    .first();

                if (user?.role === "teacher") {
                    // 선생님인 경우 - 자신이 만든 그룹만 조회
                    query = `
                        SELECT 
                            g.*,
                            u.name as teacher_name,
                            COUNT(DISTINCT gs.student_id) as student_count,
                            COUNT(DISTINCT a.id) as assignment_count
                        FROM tutoring_groups g
                        LEFT JOIN users u ON g.teacher_id = u.id
                        LEFT JOIN group_students gs ON g.id = gs.group_id
                        LEFT JOIN assignments a ON g.id = a.group_id
                        WHERE g.teacher_id = ?
                    `;
                    params.push(user_id);
                } else {
                    // 학생인 경우 - 자신이 속한 그룹과 참여 가능한 그룹 조회
                    query = `
                        SELECT 
                            g.*,
                            u.name as teacher_name,
                            COUNT(DISTINCT gs.student_id) as student_count,
                            COUNT(DISTINCT a.id) as assignment_count,
                            EXISTS(SELECT 1 FROM group_students WHERE group_id = g.id AND student_id = ?) as is_member
                        FROM tutoring_groups g
                        LEFT JOIN users u ON g.teacher_id = u.id
                        LEFT JOIN group_students gs ON g.id = gs.group_id
                        LEFT JOIN assignments a ON g.id = a.group_id
                    `;
                    params.push(user_id);
                }
            } else {
                // user_id가 없는 경우 - 모든 그룹 조회
                query = `
                    SELECT 
                        g.*,
                        u.name as teacher_name,
                        COUNT(DISTINCT gs.student_id) as student_count,
                        COUNT(DISTINCT a.id) as assignment_count
                    FROM tutoring_groups g
                    LEFT JOIN users u ON g.teacher_id = u.id
                    LEFT JOIN group_students gs ON g.id = gs.group_id
                    LEFT JOIN assignments a ON g.id = a.group_id
                `;
            }

            if (search) {
                query += ` ${
                    query.includes("WHERE") ? "AND" : "WHERE"
                } (g.name LIKE ? OR g.description LIKE ?)`;
                params.push(`%${search}%`, `%${search}%`);
            }

            query += ` GROUP BY g.id LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const groups = await c.env.DB.prepare(query)
                .bind(...params)
                .all();

            // 전체 그룹 수 조회를 위한 쿼리
            let countQuery = `SELECT COUNT(*) as total FROM tutoring_groups g`;
            const countParams = [];

            if (user_id) {
                const user = await c.env.DB.prepare(
                    `SELECT role FROM users WHERE id = ?`
                )
                    .bind(user_id)
                    .first();

                if (user?.role === "teacher") {
                    countQuery += ` WHERE teacher_id = ?`;
                    countParams.push(user_id);
                }
            }

            if (search) {
                countQuery += ` ${
                    countQuery.includes("WHERE") ? "AND" : "WHERE"
                } (name LIKE ? OR description LIKE ?)`;
                countParams.push(`%${search}%`, `%${search}%`);
            }

            const totalResult = await c.env.DB.prepare(countQuery)
                .bind(...countParams)
                .first();

            return {
                success: true,
                result: {
                    groups: groups.results,
                    total: totalResult.total,
                },
            };
        } catch (error) {
            return Response.json(
                {
                    success: false,
                    error: "Failed to fetch groups",
                },
                { status: 500 }
            );
        }
    }
}
