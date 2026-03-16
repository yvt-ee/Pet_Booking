import crypto from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    const err = new Error(`${name} is not set`);
    err.code = "S3_CONFIG_MISSING";
    throw err;
  }
  return v;
}

export function s3Client() {
  const region = requireEnv("AWS_REGION");
  const accessKeyId = requireEnv("AWS_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("AWS_SECRET_ACCESS_KEY");

  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function makeObjectKey({ kind, originalName }) {
  const ext = (originalName || "").split(".").pop();
  const safeExt =
    ext && ext.length <= 8 ? `.${ext.replace(/[^a-zA-Z0-9]/g, "")}` : "";
  const id = crypto.randomUUID();
  const ymd = new Date().toISOString().slice(0, 10);
  return `${kind}/${ymd}/${id}${safeExt}`;
}

export async function presignPut({ key, contentType }) {
  const bucket = requireEnv("S3_BUCKET");
  const client = s3Client();

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType || "application/octet-stream",
  });

  return getSignedUrl(client, cmd, { expiresIn: 300 });
}

export function publicUrlForKey(key) {
  const base = process.env.PUBLIC_S3_BASE_URL;
  const bucket = requireEnv("S3_BUCKET");
  const region = requireEnv("AWS_REGION");
  if (base) return `${base.replace(/\/$/, "")}/${key}`;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}