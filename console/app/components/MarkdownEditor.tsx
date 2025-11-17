import { useState } from "react";
import MarkdownIt from "markdown-it";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { HelpCircle } from "lucide-react";
import { MarkdownHelpModal } from "~/components/MarkdownHelpModal";

const md = new MarkdownIt({ linkify: true, breaks: true });

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write your post content in markdown...",
  disabled = false,
}: MarkdownEditorProps) {
  const [showHelp, setShowHelp] = useState(false);

  const renderMarkdown = () => {
    try {
      return md.render(value);
    } catch (error) {
      return `<p class="text-red-500">Error rendering markdown: ${error instanceof Error ? error.message : "Unknown error"}</p>`;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Content</div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowHelp(true)}
          className="h-8"
        >
          <HelpCircle className="h-4 w-4 mr-1" />
          Markdown Help
        </Button>
      </div>

      <Tabs defaultValue="edit" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="space-y-2">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[300px] font-mono text-sm"
          />

          <p className="text-xs text-muted-foreground">
            Tip: You can use markdown syntax to format your content
          </p>
        </TabsContent>

        <TabsContent value="preview">
          <div className="min-h-[300px] border rounded-md p-4 bg-muted/10">
            {value.trim() ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is sanitized by markdown-it
                dangerouslySetInnerHTML={{ __html: renderMarkdown() }}
              />
            ) : (
              <p className="text-muted-foreground text-center py-12">
                Nothing to preview yet. Start writing in the Edit tab.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <MarkdownHelpModal open={showHelp} onOpenChange={setShowHelp} />
    </div>
  );
}
