export const contactKinds = { bug: "不具合", suggestion: "改善要望", other: "その他" } as const;
export type ContactKind = keyof typeof contactKinds;
export type ContactFields = { name: string; email: string; kind: ContactKind; message: string };
export type ContactErrors = Partial<Record<keyof ContactFields, string>>;

export function validateContact(value: unknown): { fields?: ContactFields; errors: ContactErrors } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { errors: { message: "入力内容を確認してください。" } };
  const data = value as Record<string, unknown>;
  const text = (key: string) => typeof data[key] === "string" ? (data[key] as string).trim() : "";
  const name = text("name"), email = text("email"), message = text("message"), kind = text("kind");
  const errors: ContactErrors = {};
  if ((data.name !== undefined && typeof data.name !== "string") || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) errors.name = "お名前は80文字以内で入力してください。";
  if ((data.email !== undefined && typeof data.email !== "string") || email.length > 254 || /[\u0000-\u001f\u007f]/.test(email) || (email && !/^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]+$/.test(email))) errors.email = "返信先メールアドレスの形式を確認してください。";
  if (!Object.hasOwn(contactKinds, kind)) errors.kind = "問い合わせ種類を選択してください。";
  if (!message || message.length > 3000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) errors.message = "本文を1〜3000文字で入力してください。";
  if (Object.keys(errors).length) return { errors };
  return { fields: { name, email, kind: kind as ContactKind, message }, errors };
}
