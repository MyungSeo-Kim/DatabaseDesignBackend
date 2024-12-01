import { Bool, OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import {
    GroupWithDetails,
    StudentWithProgress,
    AssignmentWithProgress,
    Env,
} from "../types";

export class GroupDetail extends OpenAPIRoute {
    schema = {
        tags: ["Groups"],
        summary: "Get tutoring group details",
        request: {
            params: z.object({
                groupId: z.string(),
            }),
            query: z.object({
                user_id: z.number().optional(),
            }),
        },
        responses: {
            "200": {
                description: "Returns group details",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool(),
                            result: z.object({
                                group: GroupWithDetails,
                                students:
                                    StudentWithProgress.array().optional(),
                                assignments: AssignmentWithProgress.array(),
                            }),
                        }),
                    },
                },
            },
            "404": {
                description: "Group not found",
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
        const groupId = parseInt(data.params.groupId);
        const userId = data.query.user_id;

        try {
            // 그룹 기본 정보 조회
            const group = await c.env.DB.prepare(
                `
                SELECT 
                    g.*,
                    u.name as teacher_name,
                    COUNT(DISTINCT gs.student_id) as student_count,
                    COUNT(DISTINCT a.id) as assignment_count
                FROM tutoring_groups g
                LEFT JOIN users u ON g.teacher_id = u.id
                LEFT JOIN group_students gs ON g.id = gs.group_id
                LEFT JOIN assignments a ON g.id = a.group_id
                WHERE g.id = ?
                GROUP BY g.id
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

            let userRole = null;
            if (userId) {
                // 사용자 역할 확인
                const user = await c.env.DB.prepare(
                    `SELECT role FROM users WHERE id = ?`
                )
                    .bind(userId)
                    .first();
                userRole = user?.role;

                // 접근 권한 확인
                if (userRole === "student") {
                    const isMember = await c.env.DB.prepare(
                        `
                        SELECT 1 FROM group_students 
                        WHERE group_id = ? AND student_id = ?
                    `
                    )
                        .bind(groupId, userId)
                        .first();

                    if (!isMember) {
                        return Response.json(
                            {
                                success: false,
                                error: "Access denied",
                            },
                            { status: 403 }
                        );
                    }
                } else if (
                    userRole === "teacher" &&
                    group.teacher_id !== userId
                ) {
                    return Response.json(
                        {
                            success: false,
                            error: "Access denied",
                        },
                        { status: 403 }
                    );
                }
            }

            // 과제 목록 조회
            let assignments;
            if (userRole === "teacher") {
                assignments = await c.env.DB.prepare(
                    `
                    SELECT 
                        a.*,
                        COUNT(DISTINCT ac.student_id) as completed_students,
                        (SELECT COUNT(*) FROM group_students WHERE group_id = ?) as total_students,
                        CAST(COUNT(DISTINCT ac.student_id) AS FLOAT) / 
                        (SELECT COUNT(*) FROM group_students WHERE group_id = ?) * 100 as completion_rate
                    FROM assignments a
                    LEFT JOIN assignment_completions ac ON a.id = ac.assignment_id
                    WHERE a.group_id = ?
                    GROUP BY a.id
                    ORDER BY a.created_at DESC
                `
                )
                    .bind(groupId, groupId, groupId)
                    .all();
            } else if (userRole === "student") {
                assignments = await c.env.DB.prepare(
                    `
                    SELECT 
                        a.*,
                        EXISTS(SELECT 1 FROM assignment_completions 
                               WHERE assignment_id = a.id AND student_id = ?) as is_completed
                    FROM assignments a
                    WHERE a.group_id = ?
                    ORDER BY a.created_at DESC
                `
                )
                    .bind(userId, groupId)
                    .all();
            } else {
                assignments = await c.env.DB.prepare(
                    `
                    SELECT 
                        a.*
                    FROM assignments a
                    WHERE a.group_id = ?
                    ORDER BY a.created_at DESC
                `
                )
                    .bind(groupId)
                    .all();
            }

            // 선생님인 경우 학생 목록과 진도 현황도 함께 제공
            let students;
            if (userRole === "teacher") {
                students = await c.env.DB.prepare(
                    `
                    SELECT 
                        u.email, u.username, u.name,
                        COUNT(DISTINCT ac.assignment_id) as completed_assignments,
                        (SELECT COUNT(*) FROM assignments WHERE group_id = ?) as total_assignments,
                        CAST(COUNT(DISTINCT ac.assignment_id) AS FLOAT) / 
                        (SELECT COUNT(*) FROM assignments WHERE group_id = ?) * 100 as completion_rate
                    FROM users u
                    JOIN group_students gs ON u.id = gs.student_id
                    LEFT JOIN assignment_completions ac ON u.id = ac.student_id
                    WHERE gs.group_id = ?
                    GROUP BY u.id
                `
                )
                    .bind(groupId, groupId, groupId)
                    .all();
            }

            return {
                success: true,
                result: {
                    group,
                    ...(userRole === "teacher" && {
                        students: students.results,
                    }),
                    assignments: assignments.results,
                },
            };
        } catch (error) {
            return Response.json(
                {
                    success: false,
                    error: "Failed to fetch group details",
                },
                { status: 500 }
            );
        }
    }
}
