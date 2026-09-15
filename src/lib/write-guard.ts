export function writeKeyRequired() {
  return Boolean(process.env.IMPORT_KEY) || Boolean(process.env.VERCEL);
}

export function assertWriteAccess(request: Request, form?: FormData) {
  if (!writeKeyRequired()) return;
  const expected = process.env.IMPORT_KEY;
  if (!expected) {
    throw new Error(
      "网站已上线，请先在环境变量里设置 IMPORT_KEY，再允许导入或删除。"
    );
  }
  const provided =
    request.headers.get("x-import-key") ||
    (typeof form?.get("importKey") === "string" ? String(form.get("importKey")) : "");
  if (provided !== expected) {
    throw new Error("导入口令不对。");
  }
}
