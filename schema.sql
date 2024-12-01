-- 외래 키 제약조건 일시적으로 비활성화
PRAGMA foreign_keys = OFF;

-- 기존 테이블 삭제 (의존성 순서대로)
DROP TABLE IF EXISTS assignment_completions;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS group_students;
DROP TABLE IF EXISTS tutoring_groups;
DROP TABLE IF EXISTS user_tokens;
DROP TABLE IF EXISTS users;

-- 외래 키 제약조건 다시 활성화
PRAGMA foreign_keys = ON;

-- 사용자 테이블 (기본 테이블)
CREATE TABLE users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    role TEXT CHECK(role IN ('teacher', 'student')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 토큰 테이블
CREATE TABLE user_tokens(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 과외 그룹 테이블
CREATE TABLE tutoring_groups(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    teacher_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 그룹 멤버십 테이블
CREATE TABLE group_students(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES tutoring_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(group_id, student_id)
);

-- 그룹 멤버십에 대한 인덱스 추가
CREATE INDEX idx_group_students_student ON group_students(student_id);
CREATE INDEX idx_group_students_group ON group_students(group_id);

-- 과제 테이블
CREATE TABLE assignments(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME,
    FOREIGN KEY (group_id) REFERENCES tutoring_groups(id) ON DELETE CASCADE
);

-- 과제 완료 현황 테이블
CREATE TABLE assignment_completions(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(assignment_id, student_id)
);

-- 과제 완료 현황에 대한 인덱스 추가
CREATE INDEX idx_assignment_completions_student ON assignment_completions(student_id);
CREATE INDEX idx_assignment_completions_assignment ON assignment_completions(assignment_id); 