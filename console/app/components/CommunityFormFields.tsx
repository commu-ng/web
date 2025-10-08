import { ImageIcon, X } from "lucide-react";
import { useId, useRef } from "react";
import { HashtagInput } from "~/components/hashtag-input";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import { Field, FieldDescription, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";

export interface CommunityFormData {
  name: string;
  slug: string;
  recruiting: boolean;
  minimum_birth_year: string;
  profile_username: string;
  profile_name: string;
}

interface CommunityFormFieldsProps {
  formData: CommunityFormData;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hashtags: string[];
  onHashtagsChange: (hashtags: string[]) => void;
  startDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  endDate: Date | undefined;
  onEndDateChange: (date: Date | undefined) => void;
  recruitingStartDate: Date | undefined;
  onRecruitingStartDateChange: (date: Date | undefined) => void;
  recruitingEndDate: Date | undefined;
  onRecruitingEndDateChange: (date: Date | undefined) => void;
  isLoading?: boolean;
  showImageUpload?: boolean;
  imagePreview?: string | null;
  onImageSelect?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageRemove?: () => void;
  isUploadingImage?: boolean;
  existingCommunity?: {
    starts_at: string;
    ends_at: string;
  } | null;
}

export function CommunityFormFields({
  formData,
  onInputChange,
  hashtags,
  onHashtagsChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  recruitingStartDate,
  onRecruitingStartDateChange,
  recruitingEndDate,
  onRecruitingEndDateChange,
  isLoading = false,
  showImageUpload = false,
  imagePreview,
  onImageSelect,
  onImageRemove,
  isUploadingImage = false,
  existingCommunity = null,
}: CommunityFormFieldsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const slugId = useId();
  const minBirthYearId = useId();
  const profileUsernameId = useId();
  const profileNameId = useId();
  const recruitingId = useId();

  return (
    <>
      <Field>
        <FieldLabel htmlFor={nameId}>커뮤 이름</FieldLabel>
        <Input
          id={nameId}
          name="name"
          type="text"
          placeholder="커뮤 이름을 입력하세요"
          value={formData.name}
          onChange={onInputChange}
          required
        />
      </Field>

      <Field>
        <FieldLabel htmlFor={slugId}>커뮤 ID</FieldLabel>
        <Input
          id={slugId}
          name="slug"
          type="text"
          placeholder="커뮤 ID를 입력하세요 (예: my-community)"
          value={formData.slug}
          onChange={(e) => {
            let value = e.target.value;

            // Convert to lowercase
            value = value.toLowerCase();

            // Replace spaces with hyphens
            value = value.replace(/ /g, "-");

            // Remove all characters except alphanumerics and hyphens
            value = value.replace(/[^a-z0-9-]/g, "");

            // Replace consecutive hyphens with a single hyphen
            value = value.replace(/-+/g, "-");

            const syntheticEvent: React.ChangeEvent<HTMLInputElement> = {
              ...e,
              target: {
                ...e.target,
                name: "slug",
                value: value,
              },
            };
            onInputChange(syntheticEvent);
          }}
          required
        />
        <FieldDescription>
          영문 소문자, 숫자, 하이픈만 사용 가능합니다. 도메인 주소에 사용됩니다.
        </FieldDescription>
      </Field>

      <Separator className="my-6" />
      <h3 className="text-sm font-medium text-foreground mb-4">커뮤 이미지</h3>

      {showImageUpload && (
        <div className="space-y-2">
          <Label>커뮤 배너 이미지 (선택사항)</Label>
          <div className="border-2 border-dashed border-border rounded-lg p-4">
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="미리보기"
                  className="w-full h-auto rounded"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={onImageRemove}
                  disabled={isUploadingImage}
                >
                  <X className="h-4 w-4" />
                </Button>
                {isUploadingImage && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded">
                    <div className="text-white text-sm">업로드 중...</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImage}
                  >
                    이미지 선택
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG, GIF, WebP (최대 10MB)
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onImageSelect}
              className="hidden"
            />
          </div>
        </div>
      )}

      {!existingCommunity && (
        <>
          <Separator className="my-6" />
          <h3 className="text-sm font-medium text-foreground mb-4">
            프로필 정보
          </h3>

          <Field>
            <FieldLabel htmlFor={profileUsernameId}>ID</FieldLabel>
            <Input
              id={profileUsernameId}
              name="profile_username"
              type="text"
              placeholder="대표 프로필의 ID를 입력하세요"
              value={formData.profile_username}
              onChange={(e) => {
                const filteredValue = e.target.value.replace(
                  /[^a-zA-Z0-9_]/g,
                  "",
                );
                const syntheticEvent: React.ChangeEvent<HTMLInputElement> = {
                  ...e,
                  target: {
                    ...e.target,
                    name: "profile_username",
                    value: filteredValue,
                  },
                };
                onInputChange(syntheticEvent);
              }}
              required
            />
            <FieldDescription>
              멘션(@)과 함께 사용되는 고유한 식별자입니다. 영문, 숫자,
              언더스코어만 사용 가능합니다. 추후 수정 가능합니다.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor={profileNameId}>이름</FieldLabel>
            <Input
              id={profileNameId}
              name="profile_name"
              type="text"
              placeholder="대표 프로필의 이름을 입력하세요"
              value={formData.profile_name}
              onChange={onInputChange}
              required
            />
            <FieldDescription>
              관리자의 프로필 이름입니다. 추후 수정 가능합니다.
            </FieldDescription>
          </Field>
        </>
      )}

      <Separator className="my-6" />
      <h3 className="text-sm font-medium text-foreground mb-4">커뮤 일정</h3>

      <Field>
        <FieldLabel>시작일시</FieldLabel>
        <DateTimePicker
          value={startDate}
          onChange={onStartDateChange}
          maxDate={endDate ? new Date(endDate.getTime() - 1) : undefined}
        />
      </Field>

      <Field>
        <FieldLabel>종료일시</FieldLabel>
        <DateTimePicker
          value={endDate}
          onChange={onEndDateChange}
          minDate={startDate ? new Date(startDate.getTime() + 1) : undefined}
        />
      </Field>

      <Separator className="my-6" />
      <h3 className="text-sm font-medium text-foreground mb-4">
        공개 모집 설정 (모집 기간 동안 사이트 메인에 커뮤 정보가 노출됩니다)
      </h3>

      <Field orientation="horizontal">
        <Checkbox
          id={recruitingId}
          name="recruiting"
          checked={formData.recruiting}
          onCheckedChange={(checked) => {
            const event = {
              target: {
                name: "recruiting",
                type: "checkbox",
                checked: checked === true,
                value: "",
              },
            };
            onInputChange(event as React.ChangeEvent<HTMLInputElement>);
          }}
        />
        <FieldLabel htmlFor={recruitingId}>현재 공개 모집 중</FieldLabel>
      </Field>
      {formData.recruiting && (
        <>
          <Field>
            <FieldLabel>모집 시작일시</FieldLabel>
            <DateTimePicker
              value={recruitingStartDate}
              onChange={onRecruitingStartDateChange}
            />
          </Field>

          <Field>
            <FieldLabel>모집 종료일시</FieldLabel>
            <DateTimePicker
              value={recruitingEndDate}
              onChange={onRecruitingEndDateChange}
              minDate={
                recruitingStartDate
                  ? new Date(recruitingStartDate.getTime() + 1)
                  : undefined
              }
            />
          </Field>

          <Field>
            <FieldLabel htmlFor={minBirthYearId}>최소 나이 제한</FieldLabel>
            <Input
              id={minBirthYearId}
              name="minimum_birth_year"
              type="number"
              placeholder="예: 2005 (2005년생 이상만 가입 가능)"
              value={formData.minimum_birth_year}
              onChange={onInputChange}
              min="1900"
              max={new Date().getFullYear()}
            />
            <FieldDescription>
              지정한 연도에 태어난 사람 이상만 커뮤에 가입할 수 있습니다.
              비워두면 제한이 없습니다.
            </FieldDescription>
          </Field>

          <HashtagInput
            value={hashtags}
            onChange={onHashtagsChange}
            label="해시태그"
            placeholder="커뮤를 설명하는 해시태그를 입력하세요"
            disabled={isLoading}
          />
        </>
      )}
    </>
  );
}
