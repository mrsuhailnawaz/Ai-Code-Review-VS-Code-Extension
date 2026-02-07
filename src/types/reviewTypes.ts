export type ReviewSeverity = 'error' | 'warning' | 'info';

export interface ReviewIssue {
    line: number;
    message: string;
    severity: ReviewSeverity;
    category: string;
}

export interface ReviewResult {
    issues: ReviewIssue[];
    summary?: string;
}

export interface ReviewContext {
    fileName: string;
    startLine: number;
    endLine: number;
}

export interface ReviewHistoryEntry {
    id: string;
    fileName: string;
    issueCount: number;
    timestamp: number;
    summary?: string;
}
