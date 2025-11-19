import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface MarkdownHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkdownHelpModal({
  open,
  onOpenChange,
}: MarkdownHelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Markdown Guide</DialogTitle>
          <DialogDescription>
            Use markdown syntax to format your board posts
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <section>
            <h3 className="font-semibold mb-2">Text Formatting</h3>
            <div className="space-y-2 text-muted-foreground">
              <div>
                <code className="bg-muted px-2 py-1 rounded">**bold**</code> →{" "}
                <strong>bold</strong>
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">*italic*</code> →{" "}
                <em>italic</em>
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">
                  ~~strikethrough~~
                </code>{" "}
                → <del>strikethrough</del>
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">`code`</code> →{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  code
                </code>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Headings</h3>
            <div className="space-y-2 text-muted-foreground">
              <div className="bg-muted p-3 rounded">
                <pre className="text-xs">
                  {`# Heading 1
## Heading 2
### Heading 3`}
                </pre>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Links</h3>
            <div className="space-y-2 text-muted-foreground">
              <div>
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  [link text](https://example.com)
                </code>{" "}
                → <span className="text-primary underline">link text</span>
              </div>
              <div className="text-xs mt-2">
                URLs are automatically converted to links
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Images</h3>
            <div className="space-y-2 text-muted-foreground">
              <div>
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  ![alt text](image-url)
                </code>
              </div>
              <div className="text-xs mt-2">
                You can also use the image upload button to insert images
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Lists</h3>
            <div className="space-y-2 text-muted-foreground">
              <div>
                <p className="mb-1">Unordered list:</p>
                <div className="bg-muted p-3 rounded">
                  <pre className="text-xs">
                    {`- Item 1
- Item 2
- Item 3`}
                  </pre>
                </div>
              </div>
              <div>
                <p className="mb-1">Ordered list:</p>
                <div className="bg-muted p-3 rounded">
                  <pre className="text-xs">
                    {`1. First item
2. Second item
3. Third item`}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Blockquotes</h3>
            <div className="space-y-2 text-muted-foreground">
              <div className="bg-muted p-3 rounded">
                <pre className="text-xs">{`> This is a quote`}</pre>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Code Blocks</h3>
            <div className="space-y-2 text-muted-foreground">
              <div className="bg-muted p-3 rounded">
                <pre className="text-xs">
                  {`\`\`\`
code block
with multiple lines
\`\`\``}
                </pre>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Line Breaks</h3>
            <div className="space-y-2 text-muted-foreground">
              <p>To create a new paragraph, leave a blank line between text:</p>
              <div className="bg-muted p-3 rounded">
                <pre className="text-xs">
                  {`First paragraph.

Second paragraph.`}
                </pre>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
