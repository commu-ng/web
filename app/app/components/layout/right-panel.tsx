import { Hash, Info } from "lucide-react";
// import { OnlineUsers } from "~/components/online-users";
import { useCurrentInstance } from "~/hooks/useCurrentInstance";

export function RightPanel() {
  const { currentInstance } = useCurrentInstance();

  return (
    <aside className="w-[350px] h-screen sticky top-0 py-4 px-4 overflow-y-auto">
      {/* Instance Info Card */}
      <div className="bg-card rounded-xl border border-border p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Hash className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">
              {currentInstance?.name || "커뮤니티"}
            </h2>
            {currentInstance?.slug && (
              <p className="text-xs text-muted-foreground">
                @{currentInstance.slug}
              </p>
            )}
          </div>
        </div>
        {currentInstance?.description && (
          <p className="text-sm text-muted-foreground mb-3">
            {currentInstance.description}
          </p>
        )}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Info className="h-3 w-3" />
          <span>
            {currentInstance?.starts_at &&
              `${new Date(currentInstance.starts_at).toLocaleDateString()} ~ ${currentInstance?.ends_at ? new Date(currentInstance.ends_at).toLocaleDateString() : ""}`}
          </span>
        </div>
      </div>

      {/* Online Users */}
      {/* <OnlineUsers /> */}
    </aside>
  );
}
