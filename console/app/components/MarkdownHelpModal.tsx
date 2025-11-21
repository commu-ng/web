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
          <DialogTitle>마크다운 사용법</DialogTitle>
          <DialogDescription>
            마크다운 문법을 사용하여 내용을 작성할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <section>
            <h3 className="font-semibold mb-2">기본 서식</h3>
            <div className="space-y-2 text-muted-foreground">
              <div>
                <code className="bg-muted px-2 py-1 rounded">**굵게**</code> →{" "}
                <strong>굵게</strong>
              </div>
              <div>
                <code className="bg-muted px-2 py-1 rounded">*기울임*</code> →{" "}
                <em>기울임</em>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">제목</h3>
            <div className="space-y-2 text-muted-foreground">
              <div className="bg-muted p-3 rounded">
                <pre className="text-xs">
                  {`## 중간 제목
### 작은 제목`}
                </pre>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">목록</h3>
            <div className="space-y-2 text-muted-foreground">
              <div>
                <p className="mb-1">순서 없는 목록:</p>
                <div className="bg-muted p-3 rounded">
                  <pre className="text-xs">
                    {`- 항목 1
- 항목 2
- 항목 3`}
                  </pre>
                </div>
              </div>
              <div>
                <p className="mb-1">순서 있는 목록:</p>
                <div className="bg-muted p-3 rounded">
                  <pre className="text-xs">
                    {`1. 첫 번째
2. 두 번째
3. 세 번째`}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">인용</h3>
            <div className="space-y-2 text-muted-foreground">
              <div className="bg-muted p-3 rounded">
                <pre className="text-xs">{`> 인용문입니다.`}</pre>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold mb-2">이미지</h3>
            <div className="space-y-2 text-muted-foreground">
              <p>이미지 버튼을 클릭하여 이미지를 업로드하세요.</p>
              <div className="bg-muted p-3 rounded">
                <pre className="text-xs">{`![이미지 설명](이미지 URL)`}</pre>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
