import { env } from "~/lib/env";

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const uploadResponse = await fetch(`${env.apiBaseUrl}/app/upload/file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("session_token")}`,
    },
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error("이미지 업로드에 실패했습니다");
  }

  const uploadData = await uploadResponse.json();
  return uploadData.id;
}
