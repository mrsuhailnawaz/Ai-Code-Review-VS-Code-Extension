import * as vscode from 'vscode';
import { ReviewContext, ReviewIssue, ReviewResult } from '../types/reviewTypes';

type ReviewConfig = {
    apiKey?: string;
    model: string;
    maxIssues: number;
    useLocalFallback: boolean;
};

const DEFAULT_MODEL = 'claude-3-5-sonnet-20240620';

export class AIReviewService {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async reviewCode(code: string, languageId: string, context: ReviewContext): Promise<ReviewResult> {
        const config = this.getConfig();
        if (!config.apiKey) {
            return this.runLocalReview(code, languageId, context);
        }

        try {
            const response = await this.callAnthropic(config, code, languageId, context);
            if (response.issues.length === 0 && config.useLocalFallback) {
                return this.runLocalReview(code, languageId, context);
            }
            return response;
        } catch (error: any) {
            vscode.window.showWarningMessage(`AI review failed, running local checks. ${error.message ?? error}`);
            return this.runLocalReview(code, languageId, context);
        }
    }

    private getConfig(): ReviewConfig {
        const settings = vscode.workspace.getConfiguration('aiCodeReviewer');
        return {
            apiKey: settings.get<string>('apiKey'),
            model: settings.get<string>('model', DEFAULT_MODEL),
            maxIssues: settings.get<number>('maxIssues', 25),
            useLocalFallback: settings.get<boolean>('useLocalFallback', true)
        };
    }

    private async callAnthropic(
        config: ReviewConfig,
        code: string,
        languageId: string,
        reviewContext: ReviewContext
    ): Promise<ReviewResult> {
        const payload = {
            model: config.model,
            max_tokens: 1024,
            system: 'You are a strict code reviewer. Return JSON only, no markdown.',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `Review the following ${languageId} code from ${reviewContext.fileName}.\n` +
                                `Provide up to ${config.maxIssues} issues with line numbers.\n` +
                                'Respond with JSON in the format: {"issues":[{"line":1,"message":"...","severity":"warning","category":"..."}],"summary":"..."}.\n' +
                                'If there are no issues, return {"issues":[],"summary":"No issues found."}.\n' +
                                `Code:\n${code}`
                        }
                    ]
                }
            ]
        };

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey ?? '',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Anthropic API error: ${response.status} ${text}`);
        }

        const data = await response.json();
        const content = data?.content?.[0]?.text;
        if (!content) {
            throw new Error('No response content from Anthropic');
        }

        return this.safeParseReview(content);
    }

    private safeParseReview(text: string): ReviewResult {
        try {
            const parsed = JSON.parse(text);
            if (!parsed || !Array.isArray(parsed.issues)) {
                throw new Error('Invalid review payload');
            }
            return {
                issues: parsed.issues as ReviewIssue[],
                summary: parsed.summary
            };
        } catch (error) {
            return {
                issues: [],
                summary: 'No issues found.'
            };
        }
    }

    private runLocalReview(code: string, languageId: string, reviewContext: ReviewContext): ReviewResult {
        const issues: ReviewIssue[] = [];
        const lines = code.split(/\r?\n/);

        lines.forEach((line, index) => {
            const lineNumber = reviewContext.startLine + index + 1;

            if (/\bTODO\b|\bFIXME\b/.test(line)) {
                issues.push({
                    line: lineNumber,
                    message: 'TODO/FIXME left in code. Consider resolving or tracking this task.',
                    severity: 'info',
                    category: 'maintainability'
                });
            }

            if (/console\.log\(/.test(line) && languageId !== 'python') {
                issues.push({
                    line: lineNumber,
                    message: 'Console logging found. Remove or guard debug logs before shipping.',
                    severity: 'warning',
                    category: 'cleanliness'
                });
            }

            if (/\beval\(/.test(line)) {
                issues.push({
                    line: lineNumber,
                    message: 'Avoid using eval; it can introduce security risks and debugging issues.',
                    severity: 'error',
                    category: 'security'
                });
            }

            if (/innerHTML\s*=/.test(line)) {
                issues.push({
                    line: lineNumber,
                    message: 'Setting innerHTML can lead to XSS. Prefer textContent or sanitize input.',
                    severity: 'warning',
                    category: 'security'
                });
            }
        });

        return {
            issues: issues.slice(0, this.getConfig().maxIssues),
            summary: issues.length ? 'Local checks found potential issues.' : 'No issues found.'
        };
    }
}
