import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "커뮹 - 타임라인 기반 커뮤 플랫폼" },
    {
      name: "description",
      content: "타임라인 기반 커뮤 플랫폼",
    },
  ];
}

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 px-4 py-8">
      <ul className="space-y-4 text-lg list-disc list-inside text-muted-foreground">
        <li>복잡한 설정 없이 커뮤 전용 사이트가 자동으로 준비됩니다.</li>
        <li>
          사이트별 계정을 만들 필요 없이 커뮤별 프로필을 사용할 수 있습니다.
        </li>
        <li>취향에 맞는 커뮤를 쉽게 찾고 참여할 수 있습니다.</li>
        <li>
          문의와 버그 신고는 X를 통해 받고 있습니다:{" "}
          <a
            href="https://x.com/commu_ng"
            target="_blank"
            rel="noopener"
            className="text-primary hover:underline"
          >
            @commu_ng
          </a>
        </li>
      </ul>
    </div>
  );
}
