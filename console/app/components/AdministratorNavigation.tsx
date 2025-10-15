import { Settings, UserCog } from "lucide-react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";

export function AdministratorNavigation() {
  return (
    <div className="flex flex-wrap justify-center gap-2 max-w-2xl w-full">
      <Button variant="outline" size="sm" asChild className="flex-shrink-0">
        <Link to="/admin/boards">
          <Settings className="h-4 w-4" />
          게시판 관리
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild className="flex-shrink-0">
        <Link to="/admin/masquerade">
          <UserCog className="h-4 w-4" />
          사용자 전환
        </Link>
      </Button>
    </div>
  );
}
