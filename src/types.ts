import { DateTime, Str } from "chanfana";
import { z } from "zod";

export const User = z.object({
    email: Str({ example: "user@example.com" }),
    username: Str({ example: "johndoe" }),
    password: Str({ example: "password123" }),
    name: Str({ required: false, example: "John Doe" }),
    role: Str({ example: "teacher" }),
    created_at: DateTime(),
    updated_at: DateTime(),
});

export const UserResponse = z.object({
    email: Str({ example: "user@example.com" }),
    username: Str({ example: "johndoe" }),
    name: Str({ required: false, example: "John Doe" }),
    role: Str({ example: "teacher" }),
    created_at: DateTime(),
    updated_at: DateTime(),
});

// D1 바인딩을 위한 인터페이스
export interface Env {
    DB: D1Database;
}

// 과외 그룹 타입
export const TutoringGroup = z.object({
    id: z.number(),
    name: Str({ example: "수학 기초반" }),
    description: Str({
        required: false,
        example: "중학교 1학년 수학 기초 과정",
    }),
    teacher_id: z.number(),
    created_at: DateTime(),
    updated_at: DateTime(),
});

// 과제 타입
export const Assignment = z.object({
    id: z.number(),
    group_id: z.number(),
    title: Str({ example: "1단원 연습문제" }),
    description: Str({ required: false, example: "교재 20-25페이지 풀어오기" }),
    created_at: DateTime(),
    due_date: DateTime().optional(),
});

// 과제 완료 상태 타입
export const AssignmentCompletion = z.object({
    id: z.number(),
    assignment_id: z.number(),
    student_id: z.number(),
    completed_at: DateTime(),
});

// 그룹 상세 정보 (멤버 수 포함)
export const GroupWithDetails = TutoringGroup.extend({
    student_count: z.number(),
    teacher_name: Str(),
    assignment_count: z.number(),
});

// 학생 정보 (과제 완료율 포함)
export const StudentWithProgress = UserResponse.extend({
    completed_assignments: z.number(),
    total_assignments: z.number(),
    completion_rate: z.number(),
});

// 과제 상세 정보 (완료한 학생 수 포함)
export const AssignmentWithProgress = Assignment.extend({
    completed_students: z.number(),
    total_students: z.number(),
    completion_rate: z.number(),
    is_completed: z.boolean().optional(), // 학생용 뷰에서 사용
});
