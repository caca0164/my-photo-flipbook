export type CloudflareStreamEmbedOptions = {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
};

export function cloudflareStreamConfigured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
      process.env.CLOUDFLARE_API_TOKEN?.trim() &&
      process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim(),
  );
}

export function cloudflareStreamCustomerCode(): string | null {
  const code = process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim();
  return code || null;
}

export function cloudflareStreamThumbnailUrl(uid: string): string {
  const code = cloudflareStreamCustomerCode();
  if (!code) return "";
  return `https://customer-${code}.cloudflarestream.com/${encodeURIComponent(uid)}/thumbnails/thumbnail.jpg?time=1s&height=1080`;
}

export function cloudflareStreamIframeSrc(
  uid: string,
  options: CloudflareStreamEmbedOptions = {},
): string {
  const code = cloudflareStreamCustomerCode();
  if (!code) return "";
  const params = new URLSearchParams();
  if (options.autoplay) params.set("autoplay", "true");
  if (options.muted) params.set("muted", "true");
  if (options.loop) params.set("loop", "true");
  if (options.controls === false) params.set("controls", "false");
  const qs = params.toString();
  return `https://customer-${code}.cloudflarestream.com/${encodeURIComponent(uid)}/iframe${qs ? `?${qs}` : ""}`;
}

type DirectUploadResult = {
  uploadURL: string;
  uid: string;
};

export async function createCloudflareStreamDirectUpload(input?: {
  name?: string;
  maxDurationSeconds?: number;
}): Promise<{ error?: string; result?: DirectUploadResult }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !token) {
    return { error: "Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN" };
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        maxDurationSeconds: input?.maxDurationSeconds ?? 600,
        meta: input?.name ? { name: input.name } : undefined,
      }),
    },
  );

  const json = (await res.json()) as {
    success?: boolean;
    errors?: { message?: string }[];
    result?: { uploadURL?: string; uid?: string };
  };

  if (!res.ok || !json.success || !json.result?.uploadURL || !json.result?.uid) {
    const msg =
      json.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
      `Cloudflare Stream error (${res.status})`;
    return { error: msg };
  }

  return {
    result: {
      uploadURL: json.result.uploadURL,
      uid: json.result.uid,
    },
  };
}

export async function deleteCloudflareStreamVideo(uid: string): Promise<{ error?: string }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !token) {
    return { error: "Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN" };
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${encodeURIComponent(uid)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as {
      errors?: { message?: string }[];
    } | null;
    const msg =
      json?.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
      `Cloudflare delete failed (${res.status})`;
    return { error: msg };
  }

  return {};
}
