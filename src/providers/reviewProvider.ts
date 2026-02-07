import * as vscode from 'vscode';
import { ReviewResult } from '../types/reviewTypes';

export class ReviewProvider implements vscode.TreeDataProvider<ReviewItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ReviewItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private reviews = new Map<string, ReviewResult>();

    getTreeItem(element: ReviewItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ReviewItem): Thenable<ReviewItem[]> {
        if (!element) {
            return Promise.resolve(this.buildRootItems());
        }

        return Promise.resolve([]);
    }

    setReview(uri: vscode.Uri, review: ReviewResult) {
        this.reviews.set(uri.toString(), review);
        this._onDidChangeTreeData.fire();
    }

    clear() {
        this.reviews.clear();
        this._onDidChangeTreeData.fire();
    }

    private buildRootItems(): ReviewItem[] {
        if (this.reviews.size === 0) {
            return [new ReviewItem('No reviews yet', vscode.TreeItemCollapsibleState.None)];
        }

        const items: ReviewItem[] = [];
        for (const [uri, review] of this.reviews.entries()) {
            const fileName = vscode.Uri.parse(uri).path.split('/').pop() ?? uri;
            const item = new ReviewItem(
                `${fileName} (${review.issues.length} issue${review.issues.length === 1 ? '' : 's'})`,
                vscode.TreeItemCollapsibleState.None
            );
            item.description = review.summary ?? '';
            items.push(item);
        }

        return items;
    }
}

class ReviewItem extends vscode.TreeItem {
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState) {
        super(label, collapsibleState);
        this.contextValue = 'reviewItem';
    }
}
