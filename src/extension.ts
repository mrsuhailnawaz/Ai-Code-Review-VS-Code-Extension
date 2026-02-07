import * as vscode from 'vscode';
import { AIReviewService } from './services/aiReviewService';
import { ReviewProvider } from './providers/reviewProvider';
import { HistoryProvider } from './providers/historyProvider';
import { DiagnosticsManager } from './managers/diagnosticsManager';
import { GitManager } from './managers/gitManager';
import { ReviewResult } from './types/reviewTypes';

let reviewService: AIReviewService;
let diagnosticsManager: DiagnosticsManager;
let gitManager: GitManager;
let reviewProvider: ReviewProvider;
let historyProvider: HistoryProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('AI Code Review Assistant is now active!');

    // Initialize services
    reviewService = new AIReviewService(context);
    diagnosticsManager = new DiagnosticsManager();
    gitManager = new GitManager();

    // Register providers
    reviewProvider = new ReviewProvider();
    historyProvider = new HistoryProvider(context);

    // Register tree views
    vscode.window.registerTreeDataProvider('aiCodeReviewer.reviewResults', reviewProvider);
    vscode.window.registerTreeDataProvider('aiCodeReviewer.reviewHistory', historyProvider);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('ai-code-reviewer.reviewFile', async () => {
            await reviewCurrentFile();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-code-reviewer.reviewSelection', async () => {
            await reviewSelection();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-code-reviewer.reviewChanges', async () => {
            await reviewGitChanges();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-code-reviewer.clearReviews', () => {
            diagnosticsManager.clear();
            reviewProvider.clear();
            historyProvider.clear();
            vscode.window.showInformationMessage('All reviews cleared!');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ai-code-reviewer.configure', async () => {
            await configureExtension();
        })
    );

    // Watch for file saves
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            const config = vscode.workspace.getConfiguration('aiCodeReviewer');
            if (config.get('reviewOnSave')) {
                await reviewDocument(document);
            }
        })
    );

    // Show welcome message
    showWelcomeMessage(context);
}

async function reviewCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    await reviewDocument(editor.document);
}

async function reviewSelection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found');
        return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
        vscode.window.showWarningMessage('No text selected');
        return;
    }

    const selectedText = editor.document.getText(selection);
    await reviewCode(editor.document, selectedText, selection.start.line, selection.end.line);
}

async function reviewGitChanges() {
    try {
        const changes = await gitManager.getUnstagedChanges();

        if (changes.length === 0) {
            vscode.window.showInformationMessage('No unstaged changes found');
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Reviewing Git changes...',
            cancellable: false
        }, async (progress) => {
            for (const change of changes) {
                progress.report({ message: `Reviewing ${change.file}...` });
                await reviewCode(change.document, change.content, 0, change.content.split('\n').length);
            }
        });

        vscode.window.showInformationMessage(`Reviewed ${changes.length} changed file(s)`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to review Git changes: ${error}`);
    }
}

async function reviewDocument(document: vscode.TextDocument) {
    // Check if file should be excluded
    const config = vscode.workspace.getConfiguration('aiCodeReviewer');
    const excludePatterns = config.get<string[]>('excludePatterns', []);

    const relativePath = vscode.workspace.asRelativePath(document.uri);
    for (const pattern of excludePatterns) {
        if (minimatch(relativePath, pattern)) {
            return;
        }
    }

    const code = document.getText();
    await reviewCode(document, code, 0, document.lineCount);
}

async function reviewCode(
    document: vscode.TextDocument,
    code: string,
    startLine: number,
    endLine: number
) {
    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'AI reviewing code...',
            cancellable: true
        }, async (progress, token) => {
            const review = await reviewService.reviewCode(code, document.languageId, {
                fileName: document.fileName,
                startLine,
                endLine
            });

            if (token.isCancellationRequested) {
                return;
            }

            applyDiagnostics(document, review);
            reviewProvider.setReview(document.uri, review);
            historyProvider.addReview(document.uri, review);

            // Show summary
            const issueCount = review.issues.length;
            if (issueCount === 0) {
                vscode.window.showInformationMessage('✅ No issues found! Code looks good.');
            } else {
                vscode.window.showInformationMessage(
                    `🔍 Found ${issueCount} issue(s). Check the Problems panel for details.`
                );
            }
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Review failed: ${error.message}`);
    }
}

function applyDiagnostics(document: vscode.TextDocument, review: ReviewResult) {
    // Clear previous diagnostics for this file
    diagnosticsManager.clearForFile(document.uri);

    const diagnostics = review.issues.map(issue => {
        const line = Math.max(0, Math.min(issue.line - 1, document.lineCount - 1));
        const range = new vscode.Range(line, 0, line, Number.MAX_VALUE);

        const diagnostic = new vscode.Diagnostic(
            range,
            issue.message,
            getSeverity(issue.severity)
        );

        diagnostic.source = 'AI Code Review';
        diagnostic.code = issue.category;

        return diagnostic;
    });

    diagnosticsManager.set(document.uri, diagnostics);
}

function getSeverity(severity: string): vscode.DiagnosticSeverity {
    switch (severity.toLowerCase()) {
        case 'error':
            return vscode.DiagnosticSeverity.Error;
        case 'warning':
            return vscode.DiagnosticSeverity.Warning;
        case 'info':
            return vscode.DiagnosticSeverity.Information;
        default:
            return vscode.DiagnosticSeverity.Warning;
    }
}

async function configureExtension() {
    const config = vscode.workspace.getConfiguration('aiCodeReviewer');
    const apiKey = config.get<string>('apiKey');

    if (!apiKey) {
        const key = await vscode.window.showInputBox({
            prompt: 'Enter your Anthropic API key',
            password: true,
            placeHolder: 'sk-ant-...'
        });

        if (key) {
            await config.update('apiKey', key, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('API key saved! Extension is ready to use.');
        }
    } else {
        vscode.commands.executeCommand('workbench.action.openSettings', 'aiCodeReviewer');
    }
}

function showWelcomeMessage(context: vscode.ExtensionContext) {
    const hasShownWelcome = context.globalState.get('hasShownWelcome', false);

    if (!hasShownWelcome) {
        const config = vscode.workspace.getConfiguration('aiCodeReviewer');
        const apiKey = config.get<string>('apiKey');

        if (!apiKey) {
            vscode.window.showInformationMessage(
                'Welcome to AI Code Review Assistant! Configure your API key to get started.',
                'Configure'
            ).then(selection => {
                if (selection === 'Configure') {
                    vscode.commands.executeCommand('ai-code-reviewer.configure');
                }
            });
        }

        context.globalState.update('hasShownWelcome', true);
    }
}

// Helper function for pattern matching
function minimatch(path: string, pattern: string): boolean {
    const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
}

export function deactivate() {
    diagnosticsManager.dispose();
}
